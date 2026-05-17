# 🏛️ Interfaz Web del Consejero Estatal Digital

Se ha construido exitosamente la interfaz web robusta y premium que interactúa con tu agente Langchain existente.

## 🛠️ Cambios Realizados

1. **Backend API (FastAPI)**
   - Se creó el archivo `api.py` que envuelve toda la lógica existente de Langchain, Pinecone y Groq de tu script `chat_agente.py`.
   - Se implementaron dos endpoints:
     - `POST /api/chat`: Para el chat conversacional normal, con soporte de historial de chat.
     - `POST /api/upload`: Para recibir y auditar documentos técnicos (PDFs), manteniendo la misma funcionalidad que tenía el bot de Discord.
   - Se añadieron `fastapi`, `uvicorn`, `python-multipart` y `pydantic` al archivo `requirements.txt`.

2. **Frontend React (Vite)**
   - Se creó una nueva aplicación de React en la carpeta `frontend/`.
   - **Sistema de Diseño "Premium Peruano"**: Se usó Vanilla CSS (`index.css`) con una paleta super equilibrada que incluye rojos bicentenario institucionales y grises elegantes para sustituir al dorado, logrando un balance limpio estilo Claude/Gemini.
   - **Componente Sidebar**: Un menú lateral retráctil que simula el historial de chat y tiene un prominente botón azul/gris de "Únete a Discord" (listo para poner tu link de invitación).
   - **Componente ChatInterface**: 
     - La pantalla de bienvenida ("Welcome Screen") muestra tarjetas de sugerencias como en ChatGPT/Claude.
     - Renderiza mensajes con Markdown (soporte para viñetas y negritas).
     - El área de input ("+") permite adjuntar archivos PDF directamente para realizar la auditoría.

## 🚀 Cómo Ejecutar el Proyecto

Para probar todo el flujo en tu computadora, abre **dos terminales**:

**Terminal 1 (Backend - Python)**
```powershell
# En la raíz del proyecto, activa tu entorno virtual
.\venv\Scripts\activate
# Inicia la API de FastAPI
uvicorn api:app --reload
```
*(El backend se ejecutará en http://localhost:8000)*

**Terminal 2 (Frontend - React)**
```powershell
# Entra a la carpeta del frontend
cd frontend
# Inicia el servidor de desarrollo
npm run dev
```
*(El frontend se ejecutará en http://localhost:5173)*

> [!TIP]
> Visita `http://localhost:5173` en tu navegador. Ya puedes chatear de forma fluida con el modelo y usar el botón `+` para enviarle PDFs y que te los audite, ¡todo desde una interfaz gráfica increíble!
