/**
 * This is intended to provide similar capability as the sync api from @nodelib/fs.walk, until `eslint-plugin-import`
 * is willing to modernize and update their minimum node version to at least v16.  I intentionally made the
 * shape of the API (for the part we're using) the same as @nodelib/fs.walk so that that can be swapped in
 * when the repo is ready for it.
 */

import path from 'path';

/**
 * Do a comprehensive walk of the provided src directory, and collect all entries.  Filter out
 * any directories or entries using the optional filter functions.
 * @param {string} root - path to the root of the folder we're walking
 * @param {{ deepFilter?: ({name: string, path: string, dirent: Dirent}) => boolean, entryFilter?: ({name: string, path: string, dirent: Dirent}) => boolean }} options
 * @param {{name: string, path: string, dirent: Dirent}} currentEntry - entry for the current directory we're working in
 * @param {{name: string, path: string, dirent: Dirent}[]} existingEntries - list of all entries so far
 * @returns {{name: string, path: string, dirent: Dirent}[]} an array of directory entries
 */
export const walkSync = (root, options, currentEntry, existingEntries) => {
  const { readdirSync } = require('node:fs');

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
