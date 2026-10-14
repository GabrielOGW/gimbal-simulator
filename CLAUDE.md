# Gimbal Simulator — convenções do projeto

Ferramenta de pré-produção para simular setups de câmera em gimbals. A explicação completa de arquitetura e modelo matemático está no README.md.

## Comandos

- `npm run check`: typecheck + lint + testes. Rode antes de todo commit.
- `npm run build`: build de produção (é o que a Vercel e o CI rodam).
- `npm run dev`: servidor local.

## Regras

- **Unidades internas:** gramas, milímetros, graus. Converta só na apresentação (`src/lib/format.ts`). Toda unidade exibida precisa estar explícita.
- **Coordenadas:** X = esquerda/direita, Y = trás/frente (lente em +Y), Z = baixo/cima. Origem no centro da base da câmera. Não introduza outro referencial.
- **Matemática fica em `src/lib/`** (funções puras, com testes). Componentes React não calculam física/geometria; chamam `analyzeSetup()` ou funções de `lib/`.
- **Toda função nova em `lib/simulation` ou `lib/setup` precisa de teste.** Testes ficam ao lado do arquivo (`*.test.ts`).
- **Honestidade dos dados:** todo equipamento/gimbal tem `source.kind` (`official` | `estimated` | `user`). Nunca marque como `official` um valor que não foi conferido na ficha do fabricante. A UI nunca deve apresentar estimativa como garantia.
- **Catálogo:** JSON em `src/data/`. O teste `catalog.test.ts` valida tudo; ids devem ser únicos e estáveis (são usados em setups exportados e links).
- **Formato de setup exportado** (`lib/setup/serialization.ts`) é contrato público: mudanças incompatíveis exigem subir `SETUP_FORMAT_VERSION` e manter a importação das versões anteriores.
- **Estado da UI:** `components/simulator/state.ts` (useReducer). Ações que mudam o setup entram em `UNDOABLE`; gestos contínuos usam `groupKey`.
- **Cena 3D:** tudo dentro do grupo raiz está em mm no referencial do domínio. Gizmos/controles com tamanho em tela (TransformControls) ficam fora do grupo escalado.
- Interface em português do Brasil.
