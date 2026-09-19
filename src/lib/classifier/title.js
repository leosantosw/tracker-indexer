'use strict';

const { readable } = require('./normalize');

/**
 * Extrai o titulo limpo do nome cru, em tres passos: tira o ruido de
 * site/grupo, corta onde comecam as marcas de release e apara as sobras.
 */

// Um grupo por vez: `[^\[\]]` impede que um colchete malformado
// ("[FenixFansub} Titulo [BD]") engula o titulo inteiro ate o proximo "]".
const BRACKET_RE = /\[[^[\]]{0,60}[\]}]/g;

// Prefixo malformado: "[FenixFansub}" abre com "[" e fecha com "}".
// Preguicoso de proposito -- guloso engoliria o titulo ate o proximo "]".
const LEADING_JUNK_RE = /^\s*\[[^[\]]{0,40}?[\]}]\s*/;

const DOMAIN_RE = /\b(?:www\s*\.\s*)?[\w-]{2,}\s*\.\s*(?:com|org|net|tv|br|info|io)\b/gi;

// Sites/grupos que aparecem soltos no nome, sem dominio junto.
// "comando" sozinho e titulo de filme -- so conta com o sufixo do site.
const GROUP_RE =
  /\b(bludv|lapumia|comando[\s.]?(?:torrents|filmes|hd|to)\w*|torrentdosfilmes|thepirateshare|uindex|acesse|subvision|darkmahou)\b/gi;

/** Numeracao de anime no fim do titulo: "- 06", "- 12v2", "01-13". */
const ANIME_EPISODE_RE = /\s[-–—]\s*(\d{1,4})(?:v\d)?\s*$/;
const ANIME_RANGE_RE = /\s\d{1,3}\s*[-–—]\s*\d{1,3}\s*$/;

const SEASON_TOKEN = String.raw`s\d{1,2}\s?e\d{1,3}|s\d{1,2}(?=\s|$)|\d{1,2}\s*[ao]?\s*(?:temporada|season)`;

/** Onde o titulo acaba e comecam as marcas de release. */
const TITLE_END_RE = new RegExp(
  String.raw`\b(19\d{2}|20\d{2}` +
    String.raw`|2160p|1080p|1080i|720p|480p|4k|uhd|\d{3,4}x\d{3,4}` +
    String.raw`|web[- ]?dl|webrip|web|blu[- ]?ray|bdrip|brrip|bdremux|remux|bd` +
    String.raw`|hdtv|dvdrip|hdrip|tvrip|satrip|vhsrip|dvd` +
    String.raw`|x26[45]|h\.?26[45]|hevc|avc|av1|xvid` +
    String.raw`|mkv|avi|mp4|m4v|rmvb|mpe?g|wmv|mov` +
    String.raw`|${SEASON_TOKEN}|season|temporada` +
    String.raw`|dual|dublad[oa]|legendad[oa]|completo|completa)\b`,
  'i'
);

function removeNoise(raw) {
  return String(raw ?? '')
    .replace(LEADING_JUNK_RE, ' ')
    .replace(BRACKET_RE, ' ')
    .replace(DOMAIN_RE, ' ')
    .replace(GROUP_RE, ' ');
}

/** "Titulo (Sergei Parajanov," -> "Titulo": corta no parentese que nao fecha. */
function dropUnclosedParen(text) {
  const open = text.lastIndexOf('(');
  return open !== -1 && !text.includes(')', open) ? text.slice(0, open) : text;
}

/** Apara separadores, parenteses sem par e numeracao de episodio das pontas. */
function trimEdges(text) {
  return dropUnclosedParen(text)
    .replace(/\s*[-–—]\s*\d{1,2}\s*[ªa°]?\s*$/i, '')
    .replace(/^[\s\-–—:|.,)\]}]+/, '')
    .replace(/[\s\-–—:|.,([{+]+$/, '')
    .trim();
}

function extractTitle(raw) {
  const text = readable(removeNoise(raw));
  const cut = text.search(TITLE_END_RE);
  const head = trimEdges(cut > 0 ? text.slice(0, cut) : text);

  const episodeMatch = head.match(ANIME_EPISODE_RE);
  const title = trimEdges(
    head.replace(ANIME_EPISODE_RE, ' ').replace(ANIME_RANGE_RE, ' ')
  );

  return {
    // Se o corte comeu tudo, prefere o nome sem ruido a devolver vazio.
    title: title || trimEdges(readable(removeNoise(raw))) || null,
    episodeFromTitle: episodeMatch ? Number(episodeMatch[1]) : null,
  };
}

module.exports = { extractTitle, TITLE_END_RE };
