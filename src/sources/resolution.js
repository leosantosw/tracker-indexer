'use strict';

const NAMED_RESOLUTIONS = ['2160p', '1080p', '720p', '480p'];
const OTHER_RESOLUTION = 'other';
const RESOLUTION_IDS = [...NAMED_RESOLUTIONS, OTHER_RESOLUTION];

const resolutionId = (resolution) => (NAMED_RESOLUTIONS.includes(resolution) ? resolution : OTHER_RESOLUTION);

const acceptsResolution = (resolutions, resolution) => !resolutions || resolutions.includes(resolutionId(resolution));

module.exports = { NAMED_RESOLUTIONS, OTHER_RESOLUTION, RESOLUTION_IDS, acceptsResolution };
