# DevTask Manager – Backend API
### 42i Technical Assessment

API REST construida con **NestJS**, **TypeORM** y **PostgreSQL** para el challenge técnico *"Task System"*. Contiene toda la lógica de negocio, persistencia de datos y cálculos jerárquicos del sistema de tareas.

---

## ✨ Características Principales

### 🌳 Jerarquía Infinita
Las tareas soportan anidamiento infinito mediante el patrón **Adjacency List**. Cada tarea puede tener un `parentId` que referencia a otra tarea del mismo proyecto, permitiendo construir árboles de profundidad arbitraria sin límite de niveles.

### 📊 Analítica de Esfuerzo Recursiva
Implementación de consultas nativas con **CTEs (Common Table Expressions)** en PostgreSQL para calcular en tiempo real el esfuerzo total de un árbol de tareas completo, agrupado por estado (`TODO`, `IN_PROGRESS`, `DONE`).

```sql
WITH RECURSIVE task_tree AS (
  SELECT id, effort, status FROM tasks WHERE id = $1
  UNION ALL
  SELECT t.id, t.effort, t.status
  FROM tasks t INNER JOIN task_tree tt ON t."parentId" = tt.id
)
SELECT status, SUM(COALESCE(effort, 0)) as total
FROM task_tree GROUP BY status;
```

### 🧪 Tests Unitarios
Lógica de negocio blindada con **Jest**. Los tests cubren `ProjectsService` y `TasksService`, incluyendo mocks de QueryBuilder para el cálculo de `projectKey` y validación del parsing de floats en las analíticas.

---

## 🚀 Cómo Ejecutar el Proyecto (Docker)

El entorno está **100% contenerizado** para instalación con fricción cero.

**Pre-requisitos:** [Docker](https://docs.docker.com/get-docker/) y [Docker Compose](https://docs.docker.com/compose/install/) instalados.

```bash
# 1. Clona el repositorio
git clone https://github.com/martinezmauri/TaskSystem-Back.git
cd TaskSystem-Back

# 2. Levanta los servicios (API + PostgreSQL)
docker-compose up --build -d
```

| Servicio | URL / Puerto |
|---|---|
| API (NestJS) | `http://localhost:3001` |
| Base de datos (PostgreSQL) | `localhost:5432` |

> Los datos persisten en el volumen Docker `postgres_data` entre reinicios.

---

## 🧪 Cómo Ejecutar las Pruebas Unitarias

```bash
# Instala las dependencias localmente
npm install

# Ejecuta la suite de pruebas
npm run test
```

**Resultado esperado:**
```
Test Suites: 2 passed, 2 total
Tests:       23 passed, 23 total
```

---

## 🤖 Metodología de Uso de IA

Durante el desarrollo de esta API, se utilizaron modelos conversacionales (**Gemini 3.1 Pro** y **Claude Sonnet**) como *"sparring partners"* técnicos. Se usaron principalmente para:

- Debatir decisiones de arquitectura (ej. el uso de CTEs para la recursividad en base de datos vs. procesamiento en memoria).
- Estructurar el boilerplate inicial de las pruebas unitarias con Jest, especialmente los mocks de `createQueryBuilder`.

Todo el código generado fue **auditado, refactorizado manualmente y testeado** para asegurar el cumplimiento estricto de las reglas de negocio y tipado.

---

## 🛠️ Stack Técnico

| Tecnología | Rol |
|---|---|
| NestJS | Framework backend (controllers, services, DI) |
| TypeORM | ORM + migraciones |
| PostgreSQL 15 | Base de datos relacional |
| Jest | Testing unitario |
| Docker / Docker Compose | Contenerización |
