"""Control de acceso: solo el dueño de la conversación interactúa con paneles del bot."""
from __future__ import annotations

import discord


async def deny_if_not_owner(interaction: discord.Interaction, conv_key: tuple) -> bool:
    from discord_ui import peru_embed
    """True si se denegó (no es el dueño de la conversación)."""
    if not conv_key or len(conv_key) < 2:
        return False
    owner_id = int(conv_key[1])
    if interaction.user.id == owner_id:
        return False
    msg = (
        "Este panel pertenece a **otra persona** en este canal.\n\n"
        "Inicie **su** conversación escribiendo **`!`** + su consulta o mencionando a CEDIT."
    )
    if interaction.response.is_done():
        await interaction.followup.send(
            embed=peru_embed(msg, requested_by=interaction.user),
            ephemeral=True,
        )
    else:
        await interaction.response.send_message(
            embed=peru_embed(msg, requested_by=interaction.user),
            ephemeral=True,
        )
    return True
