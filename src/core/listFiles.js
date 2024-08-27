import path from 'path';
import { readdirSync } from 'fs';

/**
 * This is intended to provide similar capability as the sync api from @nodelib/fs.walk, until `eslint-plugin-import`
 * is willing to modernize and update their minimum node version to at least v16.  I intentionally made the
 * shape of the API (for the part we're using) the same as @nodelib/fs.walk so that that can be swapped in
 * when the repo is ready for it.
 */

/**
 * Do a comprehensive walk of the provided src directory, and collect all entries.  Filter out
 * any directories or entries using the optional filter functions.
 * @param {string} root - path to the root of the folder we're walking
 * @param {{ deepFilter?: ({name: string, path: string, dirent: Dirent}) => boolean, entryFilter?: ({name: string, path: string, dirent: Dirent}) => boolean }} options
 * @param {{name: string, path: string, dirent: Dirent}} currentEntry - entry for the current directory we're working in
 * @param {{name: string, path: string, dirent: Dirent}[]} existingEntries - list of all entries so far
 * @returns {{name: string, path: string, dirent: Dirent}[]} an array of directory entries
 */
const walkSync = (root, options, currentEntry, existingEntries) => {
  // Extract the filter functions. Default to evaluating true, if no filter passed in.
  const { deepFilter = () => true, entryFilter = () => true } = options;

  let entryList = existingEntries || [];
  const currentRelativePath = currentEntry ? currentEntry.path : '.';
  const fullPath = currentEntry ? path.join(root, currentEntry.path) : root;

  const dirents = readdirSync(fullPath, { withFileTypes: true });
  for (const dirent of dirents) {
    const entry = {
      name: dirent.name,
      path: path.join(currentRelativePath, dirent.name),
      dirent,
    };
    if (dirent.isDirectory() && deepFilter(entry)) {
      entryList.push(entry);
      entryList = walkSync(root, options, entry, entryList);
    } else if (dirent.isFile() && entryFilter(entry)) {
      entryList.push(entry);
    }
  }

  return entryList;
};

/**
 * Given a source root and list of supported extensions, use fsWalk and the
 * new `eslint` `context.session` api to build the list of files we want to operate on
 * @param {string[]} srcPaths array of source paths (for flat config this should just be a singular root (e.g. cwd))
 * @param {string[]} extensions list of supported extensions
 * @param session eslint context session object
 * @returns list of files to operate on
 */
export default function listFiles(srcPaths, extensions, session) {
  const files = [];

  for (let i = 0; i < srcPaths.length; i++) {
    const src = srcPaths[i];
    // Use walkSync along with the new session api to gather the list of files
    const entries = walkSync(src, {
      deepFilter(entry) {
        const fullEntryPath = path.resolve(src, entry.path);

        // Include the directory if it's not marked as ignore by eslint
        return !session.isDirectoryIgnored(fullEntryPath);
      },
      entryFilter(entry) {
        const fullEntryPath = path.resolve(src, entry.path);

        // Include the file if it's not marked as ignore by eslint and its extension is included in our list
        return (
          !session.isFileIgnored(fullEntryPath)
          && extensions.find((extension) => entry.path.endsWith(extension))
        );
      },
    });

    // Filter out directories and map entries to their paths
    files.push(
      ...entries
        .filter((entry) => !entry.dirent.isDirectory())
        .map((entry) => entry.path),
    );
  }
  return files;
}
