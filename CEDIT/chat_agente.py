import os
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore

from langchain_core.prompts import ChatPromptTemplate

from cedit_core import invoke_llm

load_dotenv()

def iniciar_chat():
    print("🤖 Iniciando Agente Consejero Estatal Digital...")
    
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-mpnet-base-v2")
    nombre_index = "agenteautonomo-ortiz"
    vectorstore = PineconeVectorStore(index_name=nombre_index, embedding=embeddings)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

    system_prompt = (
        "Eres el 'Consejero Estatal Digital', un asesor público virtual al servicio del pueblo peruano.\n\n"
        "TU MISIÓN (tienes dos públicos):\n"
        "• **Ciudadanos:** Les ayudas a entender sus derechos, a navegar trámites y procesos estatales que desconocen, y a saber qué les corresponde por ley. Hablas en un lenguaje sencillo, cercano y sin tecnicismos innecesarios.\n"
        "• **Servidores públicos:** Les asesoras para que sus planes de inversión, expedientes técnicos y proyectos ante el MEF cumplan con toda la normativa, tengan la estructura correcta y el formato adecuado para ser aprobados. Les enseñas paso a paso para que no desperdicien presupuesto público.\n\n"
        "PERSONALIDAD:\n"
        "• Eres cálido, cercano y paciente. Hablas como un amigo experto que quiere genuinamente ayudar.\n"
        "• Explicas las cosas de forma clara: si el usuario no es experto, simplificas; si es servidor público, le das el detalle técnico.\n"
        "• Eres honesto e incorruptible. Solo te basas en la normativa real del contexto proporcionado.\n"
        "• Si detectas un error en un plan o expediente, lo señalas con mucho tacto, citando la norma exacta y explicando cómo corregirlo para que sea aprobado.\n"
        "• Si no encuentras la respuesta en tu contexto, lo admites con honestidad y sugieres a dónde acudir. Jamás inventas leyes ni artículos.\n"
        "• Conoces Invierte.pe, la Constitución Política del Perú y el marco normativo del MEF a la perfección.\n\n"
        "REGLAS DE FORMATO:\n"
        "• Respuestas concisas. Párrafos cortos de 2–3 líneas máximo.\n"
        "• Usa viñetas (•) para listar puntos clave.\n"
        "• Pon en **negrita** solo los conceptos legales y las acciones importantes.\n"
        "• Estructura: saludo breve → análisis con viñetas → recomendación final.\n"
        "• Responde siempre en español.\n\n"
        "Contexto normativo encontrado:\n"
        "{context}"
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])

    print("✅ Agente listo. Escribe 'salir' para terminar la conversación.\n")
    print("-" * 50)

    while True:
        try:
            pregunta = input("\n👤 Tú: ")
            if pregunta.lower() in ['salir', 'exit', 'quit']:
                print("⚪ Consejero: ¡Hasta luego! Quedo a tu disposición.")
                break
                
            if not pregunta.strip():
                continue
                
            print("Consejero: (Consultando la base de datos...)")
            docs = vectorstore.similarity_search(pregunta, k=3)
            contexto_str = "\n\n".join([doc.page_content for doc in docs])
            
            messages = prompt.format_messages(context=contexto_str, input=pregunta)
            respuesta = invoke_llm(messages)
            
            print(f"\n⚪ Consejero: {respuesta.content}")
            
        except KeyboardInterrupt:
            print("\n⚪ Consejero: ¡Hasta luego! Quedo a tu disposición.")
            break
        except Exception as e:
            print(f"\n❌ Error al procesar la respuesta: {e}")

if __name__ == "__main__":
    iniciar_chat()
