import discord
from discord.ext import commands
import chromadb
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')

# Configurar cliente de Discord
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

# Configurar ChromaDB ✅ API nueva
chroma_client = chromadb.PersistentClient(path="./chroma_data")

# Obtener o crear colección
collection = chroma_client.get_or_create_collection(
    name="conversaciones",
    metadata={"hnsw:space": "cosine"}
)

@bot.event
async def on_ready():
    print(f'{bot.user} se ha conectado a Discord!')
    print('------')

@bot.command(name='pregunta')
async def preguntar(ctx, *, pregunta: str):
    """Comando para hacer preguntas al bot consejero"""
    try:
        # Buscar en ChromaDB
        resultados = collection.query(
            query_texts=[pregunta],
            n_results=3
        )
        
        if resultados['documents'] and resultados['documents'][0]:
            respuesta = f"📋 **Respuesta**: {resultados['documents'][0][0]}"
        else:
            respuesta = "No encontré información sobre eso. Por favor intenta con otra pregunta."
        
        await ctx.send(respuesta)
        
        # Guardar pregunta en ChromaDB
        collection.add(
            documents=[pregunta],
            ids=[f"pregunta_{collection.count()}"]
        )
    except Exception as e:
        await ctx.send(f"❌ Error: {str(e)}")

@bot.command(name='agregar')
async def agregar_conocimiento(ctx, *, datos: str):
    """Comando para agregar información a la base de datos"""
    try:
        collection.add(
            documents=[datos],
            ids=[f"info_{collection.count()}"]
        )
        await ctx.send("✅ Información agregada correctamente!")
    except Exception as e:
        await ctx.send(f"❌ Error al agregar: {str(e)}")

@bot.command(name='listar')
async def listar_datos(ctx):
    """Listar datos almacenados"""
    try:
        total = collection.count()
        await ctx.send(f"📊 Total de registros: {total}")
    except Exception as e:
        await ctx.send(f"❌ Error: {str(e)}")

@bot.event
async def on_message(message):
    if message.author == bot.user:
        return
    
    # Procesar comandos
    await bot.process_commands(message)

# Ejecutar el bot
if TOKEN:
    bot.run(TOKEN)
else:
    print("❌ Token de Discord no encontrado. Crea un archivo .env con DISCORD_TOKEN=tu_token")