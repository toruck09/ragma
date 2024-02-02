# Ragma

Ragma es un pequeño demo de alternativas para usar RAG con data personal. Permite añadir información a los prompts o recomendaciones sin hacer fune-tuning de algún LLM. Este proyecto usa animes como ejemplo.

## Installation

Para ejecutar el servidor es necesario tener NodeJS instalado.
Luego, clonar el proyecto e instalar las dependencias

```bash
git clone https://github.com/toruck09/ragma.git
cd ragma
cd server
npm install
```
Luego añadir variables de entorno: la API_KEY de OpenAI, datos de postgresql en caso se use y el modo: simple para busqueda exacta, vectra, pg o nada para una busqueda no optimizada.

Finalmente ejecutar el servidor

```bash
npm run dev
```

En caso se desee guardar los datos del csv en postgress ejecutar lo siguiente

```bash
npm run dev save_db
```
## Uso

Abrir el archivo index.html que está en la carpeta client; usar el navegador. Colocar los intereses o temas que deserías ver y se creará una lista de recomendaciones.

## Contribuciones

Este es un pequeño proyecto que puede mejorar, añadir nuevas tecnologías, ideas o algo que quieran incluir.