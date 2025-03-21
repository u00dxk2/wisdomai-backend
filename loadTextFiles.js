/**
 * @fileoverview Text file loading utility for the WisdomAI application.
 * Handles reading and parsing text files from a specified directory.
 */

import fs from "fs";
import path from "path";

/**
 * Load all .txt files from a specified directory.
 * Reads the content of each file and returns an array of objects containing
 * the file name and content.
 * 
 * @param {string} directory - Path to the directory containing text files
 * @returns {Array<Object>} Array of objects containing file information
 * @returns {string} Array[].fileName - Name of the text file
 * @returns {string} Array[].content - Content of the text file
 * 
 * @throws {Error} If directory cannot be read
 * @throws {Error} If a file cannot be read
 * 
 * @example
 * const texts = loadTextFiles('./knowledge');
 * console.log(texts[0].fileName); // 'example.txt'
 * console.log(texts[0].content); // 'File contents...'
 */
export const loadTextFiles = (directory) => {
  const files = fs.readdirSync(directory); // Read all files in the directory
  const textFiles = files.filter((file) => file.endsWith(".txt")); // Filter for .txt files

  const texts = textFiles.map((file) => {
    const filePath = path.join(directory, file); // Get the full file path
    return {
      fileName: file, // File name
      content: fs.readFileSync(filePath, "utf-8"), // File content
    };
  });

  return texts; // Return an array of { fileName, content } objects
};
