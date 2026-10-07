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
  "source": { "kind": "official", "reference": "site do fabricante", "note": "corpo sem bateria" }
}
```

`source.kind` é `official` (transcrito do fabricante), `estimated` (aproximado) ou `user` (informado pelo usuário). A UI sempre mostra essa origem (FAB / EST / USU).

## Sistema de coordenadas e unidades

| Eixo | Sentido | Observação |
|---|---|---|
| **X** | esquerda − / + direita | visto por trás da câmera (posição do operador) |
| **Y** | trás − / + frente | a lente aponta para +Y |
| **Z** | baixo − / + cima | |

- Origem do **referencial da carga**: centro da base da câmera, sobre a placa de engate rápido.
- `position` de um item = centro geométrico da caixa envolvente. `centerOfMass` do equipamento = deslocamento do CM **em relação ao centro geométrico**, no referencial local (gira junto com o item).
- `dimensions`: `width` → X, `height` → Z, `depth` → Y (para lentes: diâmetro × diâmetro × comprimento).
- Unidades internas: **g**, **mm**, **graus**. Conversão só na apresentação (`lib/format.ts`).
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

### 3. Balanceamento (gimbal de 3 eixos idealizado)

Referencial do gimbal: origem no **pivô**, o cruzamento dos eixos tilt (∥X) e roll (∥Y). O eixo pan é vertical, em `y = −pan`.
A carga é montada em `(roll, plate, −height)`, que são os quatro ajustes mecânicos. CM no referencial do gimbal: `c = CM + (roll, plate, −height)`.

| Eixo | Balanceado quando | Ajuste que corrige | Recomendação |
|---|---|---|---|
| Tilt | `c.y = 0` e `c.z = 0` | placa (Y) e altura (Z) | `plate* = −CM.y`, `height* = CM.z` |
| Roll | `c.x = 0` | braço horizontal (X) | `roll* = −CM.x` |
| Pan | CM sobre o eixo vertical | braço vertical (Y) | `pan* = −(CM.y + plate*)` |

As recomendações seguem a **ordem real de balanceamento** (tilt → roll → pan), cada etapa limitada ao curso mecânico do gimbal. Se o ideal estiver fora do curso, o eixo fica `out_of_range` e a UI diz quanto sobra, sugerindo contrapeso, extensão ou reposicionamento.
Status por eixo: desvio ≤ tolerância (padrão 2 mm) → `ok`; senão `adjust` ou `out_of_range`.

### 4. Torque estático

- **Pior caso:** `τ = M · g · d`, com `d` = desvio até o eixo.
- **Por pose:** com o gimbal girado (pan → roll → tilt), `τ = r × F` projetado em cada eixo, com `F = (0, 0, −M·g)`. Com a base na vertical, o torque no pan é sempre zero, e o modelo mostra isso.

### 5. Interferência (estimada)

Caixa envolvente da carga contra o braço do tilt (lado esquerdo, −X) e o motor roll (atrás). É um sinal, não uma garantia.

## Problemas identificados na especificação original (e como foram tratados)

1. **"Posição" de um item era ambígua.** Centro geométrico? Ponto de montagem? CM? Definido: `position` = centro geométrico; CM é um deslocamento local que gira com o item. Sem isso, rotacionar uma lente moveria o CM de forma errada.
2. **Mapeamento eixo ↔ desvio estava incompleto.** O tilt depende de **dois** desvios (Y *e* Z), não de um. O desvio vertical é o erro mais comum na prática (câmera "top heavy"). O roll também sofre com Z, mas Z só é corrigível pela altura do tilt; a UI explica esse acoplamento.
3. **Pan não é "deslocamento longitudinal" isolado.** Com eixos ortogonais e gimbal sem massa, balancear o tilt já põe o CM sobre o eixo pan. O ajuste de pan só é necessário (a) quando o tilt não consegue chegar ao ideal por falta de curso, ou (b) por causa da massa das partes do próprio gimbal, que o modelo ignora. O sistema diz isso em vez de inventar um número.
4. **Os ajustes interagem.** Mover a placa muda tilt *e* pan; por isso as recomendações são sequenciais, e não independentes.
5. **Pan não sofre torque gravitacional com a base vertical.** Ele só importa com o gimbal inclinado (modo lanterna, briefcase). Mostrar um torque de pan no modo vertical seria precisão falsa.
6. **Capacidade nominal ≠ capacidade utilizável.** A carga máxima dos fabricantes costuma ser "testada" com setup balanceado e sem acessórios pendurados. Daí a margem configurável.
7. **Dados de internet são imprecisos.** Peso "corpo apenas" vs "com bateria e cartão", dimensões com ou sem protuberâncias, CM quase nunca publicado. Cada valor carrega sua origem; os CMs de lente são estimativas marcadas como tal.
8. **Curso de ajuste e geometria dos gimbals não são publicados de forma padronizada.** No catálogo eles são `estimated`, e a carga máxima é `official`.

### Fora do escopo (fase 4)

Massa e inércia das partes móveis do gimbal, momento de inércia, torque máximo dos motores, aceleração e comportamento dinâmico, deflexão de braços e placas, varredura completa de colisão durante a rotação.

## Testes

`npm test` roda 62 testes unitários: massa total, CM (incluindo o exemplo 1000 g @ 0 + 500 g @ 100 → 33,33 mm), CM personalizado e rotacionado, CM ausente, setup vazio, valores inválidos, payload e margem, balanceamento (sinais, tolerância, fora de curso, convergência), torque por pose, interferência, validação do catálogo, busca, posicionamento automático e import/export.

## Fases

- **Fase 1 (MVP), feita:** catálogo, gimbals, configurador, peso, CM, payload com margem, cena 3D, equipamentos personalizados, movimentação X/Y/Z (arrastar e numérico), balanceamento.
- **Fase 2, parcialmente adiantada:** presets (locais + exemplos), import/export JSON, vistas frontal/lateral/superior, recomendações automáticas, gimbal personalizado, pontos de montagem básicos (câmera ↔ lente).
- **Fase 3:** banco (Neon), contas, setups salvos na nuvem, compartilhamento por link, catálogo colaborativo.
- **Fase 4:** física mais completa (ver acima).
