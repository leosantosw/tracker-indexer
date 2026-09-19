'use strict';

/** Dicionarios de marcas de release. Apelido normalizado -> nome canonico. */

const RESOLUTIONS = {
  '2160p': '2160p', '4k': '2160p', uhd: '2160p',
  '1080p': '1080p', '1080i': '1080p', 'full hd': '1080p',
  '720p': '720p', '480p': '480p',
  hd: 'HD',
};

const SOURCES = {
  'web dl': 'WEB-DL', webdl: 'WEB-DL', webrip: 'WEBRip', web: 'WEB',
  bluray: 'BluRay', 'blu ray': 'BluRay', bd: 'BluRay',
  bdrip: 'BDRip', brrip: 'BRRip', bdremux: 'REMUX', remux: 'REMUX',
  hdtv: 'HDTV', dvdrip: 'DVDRip', hdrip: 'HDRip',
  tvrip: 'TVRip', satrip: 'SATRip', vhsrip: 'VHSRip', dvdr: 'DVD', dvd: 'DVD',
  // Reconhecidas so para o filtro poder barrar.
  hdcam: 'CAM', camrip: 'CAM', cam: 'CAM',
  hdts: 'TS', telesync: 'TS', ts: 'TS',
  hdtc: 'TC', telecine: 'TC', tc: 'TC',
  dvdscr: 'SCR', screener: 'SCR',
};

const CONTAINERS = {
  mkv: 'MKV', avi: 'AVI', mp4: 'MP4', m4v: 'MP4', rmvb: 'RMVB',
  mpeg: 'MPEG', mpg: 'MPEG', wmv: 'WMV', mov: 'MOV',
};

const VIDEO_CODECS = {
  x265: 'x265', 'h 265': 'x265', hevc: 'HEVC',
  x264: 'x264', 'h 264': 'x264', avc: 'AVC',
  av1: 'AV1', xvid: 'XviD',
};

const AUDIO_CODECS = {
  atmos: 'Atmos', truehd: 'TrueHD',
  'dts hd': 'DTS-HD', 'dts x': 'DTS-X', dts: 'DTS',
  'e ac3': 'EAC3', eac3: 'EAC3', ddp: 'DDP', ac3: 'AC3',
  aac: 'AAC', flac: 'FLAC', opus: 'Opus', mp3: 'MP3',
};

const HDR_FORMATS = {
  hdr10plus: 'HDR10+', hdr10: 'HDR10',
  'dolby vision': 'Dolby Vision', dovi: 'Dolby Vision', dv: 'Dolby Vision',
  hlg: 'HLG', hdr: 'HDR',
};

/** Capturas de cinema: tem marca de filme, mas a qualidade nao presta. */
const BAD_SOURCES = new Set(['CAM', 'TS', 'TC', 'SCR']);

module.exports = {
  RESOLUTIONS,
  SOURCES,
  CONTAINERS,
  VIDEO_CODECS,
  AUDIO_CODECS,
  HDR_FORMATS,
  BAD_SOURCES,
};
