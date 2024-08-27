import flatMap from 'array.prototype.flatmap';

/**
 * Attempt to load the internal `FileEnumerator` class, which has existed in a couple
 * of different places, depending on the version of `eslint`.  Try requiring it from both
 * locations.
 * @returns Returns the `FileEnumerator` class if its requirable, otherwise `undefined`.
 */
function requireFileEnumerator() {
  let FileEnumerator;

  // Try getting it from the eslint private / deprecated api
  try {
    ({ FileEnumerator } = require('eslint/use-at-your-own-risk'));
  } catch (e) {
    // Absorb this if it's MODULE_NOT_FOUND
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }

    // If not there, then try getting it from eslint/lib/cli-engine/file-enumerator (moved there in v6)
    try {
      ({ FileEnumerator } = require('eslint/lib/cli-engine/file-enumerator'));
    } catch (e) {
      // Absorb this if it's MODULE_NOT_FOUND
      if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
      }
    }
  }
  return FileEnumerator;
}

/**
 *
 * @param FileEnumerator the `FileEnumerator` class from `eslint`'s internal api
 * @param {string} src path to the src root
 * @param {string[]} extensions list of supported extensions
 * @returns list of files to operate on
 */
function listFilesUsingFileEnumerator(FileEnumerator, src, extensions) {
  const e = new FileEnumerator({
    extensions,
  });

  const listOfFiles = Array.from(
    e.iterateFiles(src),
    ({ filePath, ignored }) => ({
      ignored,
      filename: filePath,
    }),
  );
  return listOfFiles;
}

/**
 * Attempt to require old versions of the file enumeration capability from v6 `eslint` and earlier, and use
 * those functions to provide the list of files to operate on
 * @param {string} src path to the src root
 * @param {string[]} extensions list of supported extensions
 * @returns list of files to operate on
 */
function listFilesWithLegacyFunctions(src, extensions) {
  try {
    // From v5.3 - v6
    const {
      listFilesToProcess: originalListFilesToProcess,
    } = require('eslint/lib/util/glob-utils');
    return originalListFilesToProcess(src, {
      extensions,
    });
  } catch (e) {
    // Absorb this if it's MODULE_NOT_FOUND
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }

    // Last place to try (pre v5.3)
    const {
      listFilesToProcess: originalListFilesToProcess,
    } = require('eslint/lib/util/glob-util');
    const patterns = src.concat(
      flatMap(src, (pattern) => extensions.map((extension) => (/\*\*|\*\./).test(pattern) ? pattern : `${pattern}/**/*${extension}`,
      ),
      ),
    );

    return originalListFilesToProcess(patterns);
  }
}

export default function listFiles(src, extensions) {
  // Fallback to og FileEnumerator
  const FileEnumerator = requireFileEnumerator();

  // If we got the FileEnumerator, then let's go with that
  if (FileEnumerator) {
    return listFilesUsingFileEnumerator(FileEnumerator, src, extensions);
  } else {
    // If not, then we can try even older versions of this capability (listFilesToProcess)
    return listFilesWithLegacyFunctions(src, extensions);
  }
}
