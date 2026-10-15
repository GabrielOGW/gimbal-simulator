# Gimbal Simulator

Ferramenta web de pré-produção para montar setups de câmera em gimbals e responder, antes do set:

> **Esse setup cabe nesse gimbal, quanto pesa, onde está o centro de massa e quanto vou precisar deslocar cada eixo para balanceá-lo?**

É uma **estimativa geométrica estática** baseada nos dados informados — não é certificação de compatibilidade nem simulação física completa.

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # typecheck + lint + testes
npm run build      # build de produção (pronto para Vercel, sem configuração extra)
```

Stack: Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · React Three Fiber + drei · Vitest.
Sem banco, sem backend: catálogo em JSON, dados do usuário em `localStorage`.

## Arquitetura

```
UI (components/)          React: painéis, cena 3D, formulários. Sem matemática.
   ↓  chama analyzeSetup() e funções puras
Domínio (lib/)            Funções puras e testáveis
   simulation/            geometry · centerOfMass · payload · balance · statics · clearance · analyze
   setup/                 placement (posicionamento automático) · factory · serialization · compatibility
   equipment/ gimbal/     tipos · validação · busca · repositório do catálogo
   ↓
Dados (data/)             JSON editável à mão: equipment/*.json, gimbals/gimbals.json, presets/
```

- **Ponto único de cálculo:** `lib/simulation/analyze.ts → analyzeSetup()`. A UI nunca calcula nada por conta própria.
- **Migração para banco:** `lib/equipment/catalog.ts` define `CatalogRepository` (`listEquipment`, `listGimbals`, ambos `async`). A página (Server Component) chama `getCatalog()` e passa o resultado ao cliente. Para usar Neon/Postgres, implemente outra versão da interface e troque em `getCatalogRepository()` — a UI não muda.
- **Persistência do usuário:** `lib/storage/local.ts` (equipamentos/gimbals personalizados, presets, critérios, setup atual). Na fase 3, vira chamada de API.
- **Estado da UI:** um `useReducer` (`components/simulator/state.ts`), sem bibliotecas de estado.
- **Validação:** todo dado vindo de JSON, formulário ou importação passa por `validateEquipment` / `validateGimbal`. Um teste garante que o catálogo inteiro é válido e que os presets só referenciam itens existentes.

### Editando o catálogo

Adicione um objeto ao JSON da categoria em `src/data/equipment/`. Campos mínimos: `id`, `name`, `category`, `weight` (g), `dimensions` (mm) e `source`. O `npm test` acusa erros.

```json
{
  "id": "minha-camera",
  "name": "Minha Câmera",
  "category": "camera",
  "weight": 900,
  "dimensions": { "width": 120, "height": 90, "depth": 100 },
  "source": {
    "kind": "official",
    "reference": "https://fabricante.com/minha-camera/specs",
    "checkedAt": "2026-10-14",
    "note": "corpo apenas, sem bateria e cartão; dimensões sem protuberâncias"
  }
}
```

`source.kind` é `official` (conferido na ficha do fabricante), `estimated` (aproximado) ou `user` (informado pelo usuário). A UI sempre mostra essa origem (FAB / EST / USU); o tooltip do selo e o inspetor mostram a fonte e a data da conferência.

Regras do catálogo (o `npm test` cobra as duas primeiras):

- `official` exige `reference` com a **URL da ficha** e `checkedAt` (data ISO da conferência).
- Itens genéricos (`generic-*`) são sempre `estimated`.
- Valor que só aparece em revenda (B&H, Adorama…) ou que não pôde ser conferido na página do fabricante fica `estimated`, com a fonte e o motivo na `note`.
- Escreva na `note` o que a ficha mede: corpo apenas vs. com bateria e cartão, com ou sem protuberâncias, com ou sem colar de tripé.
- Nos gimbals, a carga máxima costuma ser publicada (`payloadSource`); cursos de ajuste e geometria seguem `estimated`.

## Sistema de coordenadas e unidades

| Eixo | Sentido | Observação |
|---|---|---|
| **X** | esquerda − / + direita | visto por trás da câmera (posição do operador) |
| **Y** | trás − / + frente | a lente aponta para +Y |
| **Z** | baixo − / + cima | |

- Origem do **referencial da carga**: centro da base da câmera, sobre a placa de engate rápido.
- `position` de um item = centro geométrico da caixa envolvente. `centerOfMass` do equipamento = deslocamento do CM **em relação ao centro geométrico**, no referencial local (gira junto com o item).
- `dimensions`: `width` → X, `height` → Z, `depth` → Y (para lentes: diâmetro × diâmetro × comprimento).
- Unidades internas: **g**, **mm**, **graus**. Conversão só na apresentação (`lib/format.ts` e `lib/units.ts`).

### Unidades de exibição

Em **Critérios**, o usuário escolhe massa em `g / kg` ou `lb / oz` e distância em `mm` ou `pol (in)`. A escolha fica salva no navegador junto com os outros critérios (`settings.units`) e atualiza a tela inteira na hora: HUD da cena, payload, balanceamento, ajustes, inspetor, lista, seletor e formulários.

- O domínio continua 100% em g e mm. Campos numéricos aceitam a unidade escolhida (passo de 1 mm ou 0,05 in; 0,01 lb) e convertem de volta para g/mm (`fromDisplayLength` / `fromDisplayMass`).
- **Sem drift:** sair de um campo sem editar não regrava o valor, e formulários devolvem o valor original dos campos não editados (`readField`). Assim, abrir e salvar não arredonda 129,7 mm para 5,11 in → 129,79 mm. Digitar 5 in grava 127 mm, que volta a aparecer como 5 in.
- Torque continua em **N·m**; com unidades imperiais, mostra também lb·in.
- Arquivos exportados e links compartilhados são **sempre em g/mm**. A unidade é só preferência de exibição e não entra neles.
- Na cena 3D, o grupo raiz converte para o padrão Three.js (Y para cima, metros) com `rotation-x = −90°` e `scale = 0.001`, então todo o resto da cena usa o mesmo referencial do domínio.

## Modelo matemático

### 1. Massa e centro de massa

```
M  = Σ mᵢ
CM = Σ(mᵢ · cᵢ) / M,   onde cᵢ = posiçãoᵢ + Rᵢ · cmLocalᵢ
```

Sem CM informado, `cmLocal = 0` (centro geométrico) e a UI avisa: *"Centro de massa não informado. Utilizando o centro geométrico como estimativa."*
Setup vazio ou com massa zero → CM `null`. Massa negativa, `NaN` ou posição inválida → erro explícito.

### 2. Payload

```
capacidade efetiva = máximo × (1 − margem)
```

Status: `empty` → `over_capacity` (> máximo) → `above_margin` (> efetiva: "dentro da nominal, porém acima da margem") → `below_minimum` → `ok`. A margem é configurável (padrão 10%).

### 3. Balanceamento (gimbal de 3 eixos)

Referencial do gimbal: origem no **pivô**, o cruzamento dos eixos tilt (∥X) e roll (∥Y). O eixo pan é vertical, em `y = −pan`.
A carga é montada em `(roll, plate, −height)`, que são os quatro ajustes mecânicos. CM da carga no referencial do gimbal: `c = CM + (roll, plate, −height)`.

#### Massas móveis do gimbal (`movingMasses`)

Cada eixo equilibra **tudo o que gira com ele**. As partes do gimbal entram como três pontos de massa, cada um no referencial em que gira:

| Conjunto | O que é | Gira no | Posição no pivô | Por quê |
|---|---|---|---|---|
| tilt (`mT`, `t`) | morsa + braço em L | tilt (com a carga) | `t + (roll, 0, −height)` | o braço em L sobe/desce com a altura e desliza com o roll. **Não** anda com a placa: a placa de engate rápido é item do catálogo e já está na carga |
| roll (`mR`, `r`) | motor tilt + braço horizontal | roll | `r + (roll, 0, 0)` | o braço horizontal desliza no motor roll levando o motor tilt |
| pan (`mP`, `p`) | motor roll + braço vertical | pan | `p` (fixo) | o ajuste pan move o eixo pan (`y = −pan`), não o conjunto |

O motor pan e o punho não giram em nenhum desses eixos e ficam de fora. Sem `movingMasses`, as três massas são zero e o resultado é **idêntico** ao do modelo sem massa. No catálogo, todas as massas são `estimated`: nenhum fabricante as publica. A nota de cada gimbal explica a origem (fração do peso do estabilizador, posições derivadas da geometria estimada).

#### Equações (M = massa da carga, CM no referencial da carga)

| Eixo | O que gira | Balanceado quando | Recomendação |
|---|---|---|---|
| Tilt | carga + tilt | `M·c + mT·T` com y = 0 e z = 0 | `plate* = −(CM.y + mT·t.y/M)`, `height* = (M·CM.z + mT·t.z)/(M + mT)` |
| Roll | carga + tilt + roll | x do CM combinado = 0 | `roll* = −(M·CM.x + mT·t.x + mR·r.x)/(M + mT + mR)` |
| Pan | carga + tilt + roll + pan | CM combinado sobre o eixo vertical | `pan* = −Y`, com Y = y do CM combinado depois do tilt recomendado |

Com o tilt balanceado, a carga e o conjunto tilt somam y = 0. O que sobra em Y vem dos conjuntos roll e pan, que ficam **atrás** da carga, e é isso que o pan compensa: `pan* = −(mR·r.y + mP·p.y)/(M + mT + mR + mP)`, positivo (o conjunto avança). Sem massas, o pan só pede ajuste quando o tilt não alcança o ideal por falta de curso.

As recomendações seguem a **ordem real de balanceamento** (tilt → roll → pan). Cada etapa é limitada ao curso mecânico do gimbal e usa o resultado da anterior. Como cada recomendação é fechada (não depende do ajuste atual), aplicar uma vez basta quando tudo cabe no curso; aplicar de novo não muda nada. Se o ideal estiver fora do curso, o eixo fica `out_of_range` e a UI mostra quanto falta, sugerindo contrapeso, extensão ou reposicionamento.
Status por eixo: desvio ≤ tolerância (padrão 2 mm) → `ok`; senão `adjust` ou `out_of_range`. O desvio e o torque de pior caso usam o CM e a massa **do conjunto que gira** naquele eixo.

### 4. Torque estático

- **Pior caso:** `τ = M · g · d`, com `d` = desvio até o eixo.
- **Por pose:** com o gimbal girado (pan → roll → tilt), `τ = r × F` projetado em cada eixo, com `F = (0, 0, −m·g)` para cada corpo. A carga e o conjunto tilt entram no tilt e no roll; o conjunto roll entra só no roll (não gira no tilt). Com a base na vertical, o torque no pan é sempre zero, e o modelo mostra isso.

### 5. Interferência (estimada)

Caixa envolvente da carga contra o braço do tilt (lado esquerdo, −X) e o motor roll (atrás). É um sinal, não uma garantia.

## Problemas identificados na especificação original (e como foram tratados)

1. **"Posição" de um item era ambígua.** Centro geométrico? Ponto de montagem? CM? Definido: `position` = centro geométrico; CM é um deslocamento local que gira com o item. Sem isso, rotacionar uma lente moveria o CM de forma errada.
2. **Mapeamento eixo ↔ desvio estava incompleto.** O tilt depende de **dois** desvios (Y *e* Z), não de um. O desvio vertical é o erro mais comum na prática (câmera "top heavy"). O roll também sofre com Z, mas Z só é corrigível pela altura do tilt; a UI explica esse acoplamento.
3. **Pan não é "deslocamento longitudinal" isolado.** Com eixos ortogonais e gimbal sem massa, balancear o tilt já põe o CM sobre o eixo pan. O ajuste de pan só é necessário (a) quando o tilt não consegue chegar ao ideal por falta de curso, ou (b) por causa da massa das partes do próprio gimbal (motor roll e braços, atrás da carga). O modelo cobre (b) com `movingMasses` estimadas e diz na UI que elas são estimadas.
4. **Os ajustes interagem.** Mover a placa muda tilt *e* pan; por isso as recomendações são sequenciais, e não independentes.
5. **Pan não sofre torque gravitacional com a base vertical.** Ele só importa com o gimbal inclinado (modo lanterna, briefcase). Mostrar um torque de pan no modo vertical seria precisão falsa.
6. **Capacidade nominal ≠ capacidade utilizável.** A carga máxima dos fabricantes costuma ser "testada" com setup balanceado e sem acessórios pendurados. Daí a margem configurável.
7. **Dados de internet são imprecisos.** Peso "corpo apenas" vs "com bateria e cartão", dimensões com ou sem protuberâncias, CM quase nunca publicado. Cada valor carrega sua origem; os CMs de lente são estimativas marcadas como tal.
8. **Curso de ajuste e geometria dos gimbals não são publicados de forma padronizada.** No catálogo eles são `estimated`; a carga máxima é `official` quando conferida na página do fabricante (com URL e data).

### Fora do escopo (fase 4)

Inércia das partes móveis do gimbal (as massas já entram como pontos), momento de inércia, torque máximo dos motores, aceleração e comportamento dinâmico, deflexão de braços e placas, varredura completa de colisão durante a rotação.

## Testes

`npm test` roda os testes unitários: massa total, CM (incluindo o exemplo 1000 g @ 0 + 500 g @ 100 → 33,33 mm), CM personalizado e rotacionado, CM ausente, setup vazio, valores inválidos, payload e margem, balanceamento (sinais, tolerância, fora de curso, convergência, massas móveis do gimbal), torque por pose, interferência, validação do catálogo, busca, posicionamento automático, import/export, link compartilhado e o reducer da interface (desfazer/refazer).

## Atalhos e compartilhamento

| Ação | Atalho |
|---|---|
| Desfazer / refazer | Ctrl+Z / Ctrl+Shift+Z (ou Ctrl+Y) — ⌘ no Mac |
| Remover item selecionado | Delete / Backspace |
| Limpar seleção | Esc |

Um arraste ou um movimento de slider conta como **um** passo de desfazer.

**Compartilhar** copia um link com o setup inteiro (inclusive equipamentos e gimbal personalizados) comprimido no fragmento da URL (`#s=…`). O fragmento não é enviado ao servidor, então funciona sem banco e sem conta. Para setups permanentes, use Exportar (JSON).

## Fases

- **Fase 1 (MVP), feita:** catálogo, gimbals, configurador, peso, CM, payload com margem, cena 3D, equipamentos personalizados, movimentação X/Y/Z (arrastar e numérico), balanceamento.
- **Fase 2, parcialmente adiantada:** presets (locais + exemplos), import/export JSON, vistas frontal/lateral/superior, recomendações automáticas, gimbal personalizado, pontos de montagem básicos (câmera ↔ lente).
- **Fase 3:** banco (Neon), contas, setups salvos na nuvem, catálogo colaborativo. (Compartilhamento por link já existe, sem servidor.)
- **Fase 4:** física mais completa (ver acima).
