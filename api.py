import os
import io
import hashlib
import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
from dotenv import load_dotenv
from fpdf import FPDF

from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from pypdf import PdfReader

load_dotenv()

app = FastAPI(title="API Consejero Estatal Digital")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("🧠 Cargando modelo de embeddings y conectando a Pinecone...")
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-mpnet-base-v2")
nombre_index = "agenteautonomo-ortiz"
vectorstore = PineconeVectorStore(index_name=nombre_index, embedding=embeddings)

llm = ChatGroq(
    temperature=0.2,
    model_name="llama-3.3-70b-versatile"
)

def load_cognitive_architecture():
    mind_dir = os.path.join(os.path.dirname(__file__), "agent_mind")
    files = ["master.md", "soul.md", "instinct.md", "vision.md", "plan.md"]
    prompt_parts = []
    
    print("🧠 Cargando Arquitectura Cognitiva (Lóbulos del Agente)...")
    for f in files:
        file_path = os.path.join(mind_dir, f)
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as file:
                prompt_parts.append(file.read())
                print(f"  ✅ {f} cargado.")
        else:
            print(f"  ⚠️ {f} no encontrado.")
            
    base_prompt = "\n\n".join(prompt_parts)
    return base_prompt + "\n\nContexto normativo encontrado:\n{context}"

SYSTEM_PROMPT_TEXT = load_cognitive_architecture()

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT_TEXT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        # Recuperar contexto
        docs = vectorstore.similarity_search(request.message, k=3)
        contexto_str = "\n\n".join([doc.page_content for doc in docs])

        # Formatear historial
        formatted_history = []
        for msg in request.history[-6:]:  # Limitar a los últimos 6 mensajes
            if msg.role == "user":
                formatted_history.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                formatted_history.append(AIMessage(content=msg.content))

        messages = prompt.format_messages(
            context=contexto_str,
            chat_history=formatted_history,
            input=request.message
        )
        
        respuesta = llm.invoke(messages)
        
        return {"response": respuesta.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF.")
    
    try:
        content = await file.read()
        pdf_file = io.BytesIO(content)
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"

        if not text.strip():
            raise HTTPException(status_code=400, detail="No se pudo extraer texto del PDF.")

        conceptos_clave = text[:1000]
        docs = vectorstore.similarity_search(conceptos_clave, k=4)
        contexto_str = "\n\n".join([doc.page_content for doc in docs])

        pregunta_auditoria = (
            f"Realiza una auditoría completa del siguiente expediente/documento técnico.\n\n"
            f"CONTENIDO DEL EXPEDIENTE:\n{text[:6000]}\n\n"
            f"Analiza su viabilidad, identifica brechas legales frente a la normativa y dame tu dictamen final."
        )

        messages = prompt.format_messages(
            context=contexto_str,
            chat_history=[],
            input=pregunta_auditoria
        )

        respuesta = llm.invoke(messages)

        return {"response": respuesta.content, "filename": file.filename}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class GeneratePDFRequest(BaseModel):
    content: str
    title: str = "Plan de Inversión Pública"
    project_name: str = "Proyecto CEDIT"
    modifications: Optional[str] = None
    history: Optional[List[ChatMessage]] = []

class RefinePlanRequest(BaseModel):
    original_content: str
    user_request: str
    history: List[ChatMessage] = []

class CEDITPdf(FPDF):
    def __init__(self, title, project_name):
        super().__init__()
        self.doc_title = title
        self.project_name = project_name

    def header(self):
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(173, 0, 23)
        self.cell(0, 6, 'CONSEJERO ESTATAL DIGITAL (CEDIT)', align='L')
        self.cell(0, 6, 'Documento Generado por IA', align='R', new_x='LMARGIN', new_y='NEXT')
        self.set_draw_color(173, 0, 23)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-20)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        fecha = datetime.datetime.now().strftime('%d/%m/%Y %H:%M')
        self.cell(0, 5, f'CEDIT - Consejero Estatal Digital | Generado: {fecha}', align='L')
        self.cell(0, 5, f'Pagina {self.page_no()}/{{nb}}', align='R', new_x='LMARGIN', new_y='NEXT')

    def add_title_page(self):
        self.add_page()
        self.ln(40)
        self.set_font('Helvetica', 'B', 28)
        self.set_text_color(173, 0, 23)
        self.cell(0, 15, self.doc_title, align='C', new_x='LMARGIN', new_y='NEXT')
        if self.project_name:
            self.ln(8)
            self.set_font('Helvetica', '', 16)
            self.set_text_color(74, 74, 74)
            self.cell(0, 10, self.project_name, align='C', new_x='LMARGIN', new_y='NEXT')
        self.ln(20)
        self.set_draw_color(212, 175, 55)
        self.set_line_width(1)
        self.line(60, self.get_y(), 150, self.get_y())
        self.ln(15)
        self.set_font('Helvetica', 'I', 11)
        self.set_text_color(100, 100, 100)
        fecha = datetime.datetime.now().strftime('%d de %B de %Y')
        self.cell(0, 8, f'Fecha de emision: {fecha}', align='C', new_x='LMARGIN', new_y='NEXT')

    def add_content(self, text):
        self.add_page()
        lines = text.split('\n')
        for line in lines:
            stripped = line.strip()
            if not stripped:
                self.ln(4)
                continue
            if stripped.startswith('# '):
                self.ln(6)
                self.set_font('Helvetica', 'B', 18)
                self.set_text_color(173, 0, 23)
                self.multi_cell(0, 9, stripped[2:])
                self.ln(3)
            elif stripped.startswith('## '):
                self.ln(4)
                self.set_font('Helvetica', 'B', 14)
                self.set_text_color(74, 74, 74)
                self.multi_cell(0, 8, stripped[3:])
                self.ln(2)
            elif stripped.startswith('### '):
                self.ln(3)
                self.set_font('Helvetica', 'B', 12)
                self.set_text_color(100, 100, 100)
                self.multi_cell(0, 7, stripped[4:])
                self.ln(2)
            elif stripped.startswith(('- ', '* ', '\u2022 ')):
                self.set_font('Helvetica', '', 11)
                self.set_text_color(30, 30, 30)
                clean = stripped.lstrip('-*\u2022 ').strip()
                bold_parts = clean.split('**')
                x_start = self.get_x() + 5
                self.cell(5, 7, '-')
                for i, part in enumerate(bold_parts):
                    if i % 2 == 1:
                        self.set_font('Helvetica', 'B', 11)
                    else:
                        self.set_font('Helvetica', '', 11)
                    self.write(7, part)
                self.ln(7)
            else:
                self.set_font('Helvetica', '', 11)
                self.set_text_color(30, 30, 30)
                clean = stripped.replace('**', '')
                self.multi_cell(0, 7, clean)
                self.ln(1)


def sanitize_for_pdf(text: str) -> str:
    if not text:
        return ""
    replacements = {
        '“': '"',
        '”': '"',
        '‘': "'",
        '’': "'",
        '—': '-',
        '–': '-',
        '•': '-',
        '…': '...',
        '\u201c': '"',
        '\u201d': '"',
        '\u2018': "'",
        '\u2019': "'",
        '\u2014': '-',
        '\u2013': '-',
        '\u2022': '-',
        '\u2026': '...',
        '\xa0': ' '
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text.encode('latin-1', 'ignore').decode('latin-1')


@app.post("/api/generate-pdf")
async def generate_pdf(request: GeneratePDFRequest):
    try:
        content = request.content

        if request.modifications:
            modification_prompt = (
                f"Tienes el siguiente plan/documento generado previamente:\n\n"
                f"{content[:4000]}\n\n"
                f"El usuario solicita estas modificaciones: {request.modifications}\n\n"
                f"Reescribe el documento completo incorporando los cambios solicitados. "
                f"Mantén el formato con encabezados markdown (##) y viñetas."
            )
            docs = vectorstore.similarity_search(request.modifications, k=2)
            contexto_str = "\n\n".join([doc.page_content for doc in docs])
            messages = prompt.format_messages(
                context=contexto_str, chat_history=[], input=modification_prompt
            )
            respuesta = llm.invoke(messages)
            content = respuesta.content

        # Acumular historial de chat para incorporar todas las decisiones posteriores del usuario y refinamientos del plan
        historial_contexto = ""
        if request.history:
            historial_contexto = "\n--- HISTORIAL DE DECISIONES Y REFINAMIENTOS ACUMULADOS ---\n"
            for h in request.history:
                role_name = "Usuario" if h.role == "user" else "Asesor CEDIT"
                historial_contexto += f"{role_name}: {h.content}\n"
            historial_contexto += "---------------------------------------------------------\n\n"

        # Generar un plan técnico extenso, oficial y formal del MEF (sin saludos ni filler de chat)
        generating_prompt = (
            "Eres un consultor experto en planificación y estructuración de proyectos de inversión pública bajo las directivas del MEF (Ministerio de Economía y Finanzas del Perú) y el marco de Invierte.pe.\n\n"
            "Tu tarea es tomar la siguiente conversación y asesoramiento y formular un DOCUMENTO TÉCNICO OFICIAL, EXTENSO Y ALTAMENTE DETALLADO (un plan de proyecto / plan de reestructuración completo).\n\n"
            "El documento generado debe incluir obligatoriamente las siguientes secciones:\n"
            "## 1. RESUMEN EJECUTIVO Y DATOS GENERALES\n"
            "   - Nombre del Proyecto y justificación bajo el cierre de brechas prioritarias del MEF.\n"
            "   - Localización y diagnóstico de la situación actual.\n\n"
            "## 2. ANÁLISIS DE VIABILIDAD TÉCNICA, SOCIAL Y AMBIENTAL\n"
            "   - Sustento de viabilidad física y disponibilidad de activos públicos.\n"
            "   - Beneficiarios directos e indirectos e impacto social esperado.\n\n"
            "## 3. PRESUPUESTO DETALLADO Y CRONOGRAMA DE EJECUCIÓN\n"
            "   - Desglose detallado de costos (Fase de Formulación, Expediente Técnico, Ejecución de Obra, Supervisión y Liquidación).\n"
            "   - Cronograma estimado físico-financiero del ciclo de inversión.\n\n"
            "## 4. MATRIZ DE RIESGOS Y ESTRATEGIA DE MITIGACIÓN\n"
            "   - Identificación de riesgos críticos (retrasos de obra, sobrecostos, conflictos sociales, factores climáticos).\n"
            "   - Plan de contingencia y estrategias de mitigación normativas según directivas del MEF.\n\n"
            "## 5. CONCLUSIONES Y RECOMENDACIONES DE INVIERTE.PE\n"
            "   - Recomendaciones específicas para la Fase de Funcionamiento y Sostenibilidad técnica.\n\n"
            "REGLAS CRÍTICAS:\n"
            "- Genera un plan amplio, extenso, extremadamente profesional, riguroso y detallado.\n"
            "- NO incluyas NINGÚN rastro de la conversación o chat (nada de saludos, introducciones, ni comentarios como 'Aquí te presento el plan', 'Espero que te sirva').\n"
            "- Empieza directamente con el título del plan en la primera sección técnica.\n"
            "- Incorpora absolutamente todos los detalles discutidos en el historial de refinamientos.\n\n"
            f"Contexto del asesoramiento y requisitos acumulados:\n{historial_contexto}"
            f"Propuesta o plan de partida a expandir:\n{content}"
        )
        
        messages_clean = [
            HumanMessage(content="Eres un planificador y redactor técnico oficial del MEF. Redactas planes técnicos de inversión muy extensos y directos sin saludos ni comentarios conversacionales."),
            HumanMessage(content=generating_prompt)
        ]
        respuesta_clean = llm.invoke(messages_clean)
        content = respuesta_clean.content

        pdf = CEDITPdf(
            title=sanitize_for_pdf(request.title), 
            project_name=sanitize_for_pdf(request.project_name)
        )
        pdf.alias_nb_pages()
        pdf.add_title_page()
        pdf.add_content(sanitize_for_pdf(content))

        pdf_buffer = io.BytesIO()
        pdf_output = pdf.output()
        pdf_buffer.write(pdf_output)
        pdf_buffer.seek(0)

        doc_hash = hashlib.sha256(pdf_output).hexdigest()
        filename = f"CEDIT_Plan_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Blockchain-Hash": f"0x{doc_hash[:40]}",
                "X-Network": "zkSYS Syscoin Testnet"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/refine-plan")
async def refine_plan(request: RefinePlanRequest):
    try:
        refine_prompt = (
            f"Tienes este plan/documento previo:\n\n"
            f"{request.original_content[:5000]}\n\n"
            f"El usuario pide: {request.user_request}\n\n"
            f"Reescribe el plan COMPLETO con los cambios solicitados. "
            f"Usa formato markdown con ## para secciones y viñetas con - para detalles. "
            f"Asegurate de cumplir con la normativa del MEF y el marco de Invierte.pe."
        )

        docs = vectorstore.similarity_search(request.user_request, k=3)
        contexto_str = "\n\n".join([doc.page_content for doc in docs])

        formatted_history = []
        for msg in request.history[-4:]:
            if msg.role == "user":
                formatted_history.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                formatted_history.append(AIMessage(content=msg.content))

        messages = prompt.format_messages(
            context=contexto_str, chat_history=formatted_history, input=refine_prompt
        )
        respuesta = llm.invoke(messages)

        return {"response": respuesta.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
