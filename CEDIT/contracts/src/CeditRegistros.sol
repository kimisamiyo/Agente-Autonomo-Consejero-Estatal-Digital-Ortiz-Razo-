// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title CeditRegistros
 * @dev Smart Contract ERC-721 para la atestación on-chain y anonimizada
 * de las conversaciones del Consejero Estatal Digital (CEDIT).
 */
contract CeditRegistros is ERC721URIStorage, Ownable {
    using Strings for uint256;

    uint256 private _nextTokenId;

    struct Registro {
        string channel;            // Canal (WhatsApp, Telegram, Discord, Web)
        string userHash;           // Hash SHA-256/Keccak-256 anónimo del usuario (sin PII)
        string conversationText;   // Transcripción sanitizada/redactada en texto plano
        uint256 timestamp;         // Fecha de registro
    }

    // Mapeo de Token ID a los detalles de la conversación
    mapping(uint256 => Registro) public registros;

    event RegistroAcunado(
        uint256 indexed tokenId,
        address indexed recipient,
        string channel,
        string userHash
    );

    constructor() ERC721("CEDIT Registros", "CEDITREG") Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    /**
     * @notice Acuña un nuevo NFT con el registro anonimizado de una conversación.
     * @param recipient Dirección que recibirá el NFT.
     * @param channel Canal de origen (ej. "WhatsApp", "Telegram", "Discord", "Web").
     * @param userHash Hash anónimo del identificador del usuario.
     * @param conversationText Texto plano de la conversación sanitizada.
     * @return El ID del token acuñado.
     */
    function mintRegistro(
        address recipient,
        string calldata channel,
        string calldata userHash,
        string calldata conversationText
    ) external onlyOwner returns (uint256) {
        return _mintRegistro(recipient, channel, userHash, conversationText);
    }

    /// @notice Web: el usuario acuña en su wallet (confirma en MetaMask/Pali).
    function mintRegistroSelf(
        string calldata channel,
        string calldata userHash,
        string calldata conversationText
    ) external returns (uint256) {
        return _mintRegistro(msg.sender, channel, userHash, conversationText);
    }

    function _mintRegistro(
        address recipient,
        string calldata channel,
        string calldata userHash,
        string calldata conversationText
    ) internal returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        registros[tokenId] = Registro({
            channel: channel,
            userHash: userHash,
            conversationText: conversationText,
            timestamp: block.timestamp
        });

        _safeMint(recipient, tokenId);

        string memory tokenMetadataURI = _generateTokenURI(tokenId);
        _setTokenURI(tokenId, tokenMetadataURI);

        emit RegistroAcunado(tokenId, recipient, channel, userHash);

        return tokenId;
    }

    /**
     * @dev Genera el Token URI completo en formato base64 directamente on-chain.
     */
    function _generateTokenURI(uint256 tokenId) internal view returns (string memory) {
        Registro memory reg = registros[tokenId];

        // 1. Generar la imagen SVG dinámica
        string memory svg = _generateSVG(reg.channel, reg.userHash, reg.timestamp);
        string memory svgBase64 = Base64.encode(bytes(svg));

        // 2. Construir los atributos JSON
        string memory attributes = string(
            abi.encodePacked(
                "[",
                '{"trait_type": "Canal", "value": "', reg.channel, '"},',
                '{"trait_type": "Hash de Usuario", "value": "', reg.userHash, '"},',
                '{"trait_type": "Fecha de Registro (Unix)", "value": ', reg.timestamp.toString(), "},",
                '{"trait_type": "Conversacion", "value": "', _escapeJsonString(reg.conversationText), '"}'
                "]"
            )
        );

        // 3. Crear el JSON de metadatos completo
        string memory json = string(
            abi.encodePacked(
                "{",
                '"name": "Conversacion CEDIT (', reg.channel, ')",',
                '"description": "Registro oficial de atestacion de conversacion anonimizada en el canal ', reg.channel, '. Cumple con las medidas preventivas de proteccion de datos personales.",',
                '"image": "data:image/svg+xml;base64,', svgBase64, '",',
                '"attributes": ', attributes,
                "}"
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    /**
     * @dev Genera un SVG representativo de la conversación del canal para mostrar en el NFT.
     */
    function _generateSVG(
        string memory channel,
        string memory userHash,
        uint256 timestamp
    ) internal pure returns (string memory) {
        // Reducir la visualización del hash para el diseño visual
        string memory shortHash = bytes(userHash).length > 12
            ? string(abi.encodePacked(_substring(userHash, 0, 8), "...", _substring(userHash, bytes(userHash).length - 4, bytes(userHash).length)))
            : userHash;

        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 350 350">',
                '<style>',
                '.bg { fill: #0F172A; }',
                '.title { fill: #AD0017; font-family: system-ui, sans-serif; font-size: 16px; font-weight: 800; letter-spacing: 0.5px; }',
                '.label { fill: #64748B; font-family: system-ui, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }',
                '.val { fill: #F8FAFC; font-family: system-ui, sans-serif; font-size: 12px; font-weight: 600; }',
                '.border { stroke: #AD0017; stroke-width: 2; fill: none; opacity: 0.8; }',
                '.status { fill: #10B981; font-family: system-ui, sans-serif; font-size: 11px; font-weight: 700; }',
                '</style>',
                '<rect width="100%" height="100%" class="bg"/>',
                '<rect x="15" y="15" width="320" height="320" rx="12" class="border"/>',
                '<text x="35" y="55" class="title">CONVERSACION CEDIT</text>',
                '<text x="35" y="90" class="label">Canal de Origen</text>',
                '<text x="35" y="110" class="val">', channel, '</text>',
                '<text x="35" y="150" class="label">Hash de Usuario (Anonimizado)</text>',
                '<text x="35" y="170" class="val">', shortHash, '</text>',
                '<text x="35" y="210" class="label">Marca de Tiempo (Unix)</text>',
                '<text x="35" y="230" class="val">', timestamp.toString(), '</text>',
                '<text x="35" y="280" class="label">Estado de la Atestacion</text>',
                '<text x="35" y="300" class="status">&#x2713; EN CADENA &amp; SANITIZADO</text>',
                '</svg>'
            )
        );
    }

    /**
     * @dev Sanitiza caracteres especiales para evitar romper el string de JSON.
     */
    function _escapeJsonString(string memory str) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        uint256 length = strBytes.length;

        // Contar caracteres que necesitan escape
        uint256 extraLength = 0;
        for (uint256 i = 0; i < length; i++) {
            if (strBytes[i] == '"' || strBytes[i] == '\\' || strBytes[i] == '\n' || strBytes[i] == '\r') {
                extraLength++;
            }
        }

        if (extraLength == 0) {
            return str;
        }

        bytes memory result = new bytes(length + extraLength);
        uint256 rIndex = 0;
        for (uint256 i = 0; i < length; i++) {
            if (strBytes[i] == '"') {
                result[rIndex++] = '\\';
                result[rIndex++] = '"';
            } else if (strBytes[i] == '\\') {
                result[rIndex++] = '\\';
                result[rIndex++] = '\\';
            } else if (strBytes[i] == '\n') {
                result[rIndex++] = '\\';
                result[rIndex++] = 'n';
            } else if (strBytes[i] == '\r') {
                result[rIndex++] = '\\';
                result[rIndex++] = 'r';
            } else {
                result[rIndex++] = strBytes[i];
            }
        }
        return string(result);
    }

    /**
     * @dev Función utilitaria para extraer substrings.
     */
    function _substring(string memory str, uint256 startIndex, uint256 endIndex) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex - startIndex);
        for (uint256 i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = strBytes[i];
        }
        return string(result);
    }
}
