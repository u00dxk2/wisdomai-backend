import fs from "fs";
import path from "path";

// Function to load all .txt files from a directory
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
