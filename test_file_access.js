const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "uploads", "1740559919539_catmeme.zip");

console.log("📂 Checking File Path:", filePath);

// Check if the file exists
fs.access(filePath, fs.constants.F_OK, (err) => {
  if (err) {
    console.error("🚨 ERROR: File does not exist!", err);
  } else {
    console.log("✅ SUCCESS: File exists.");
    
    // Check if file is readable
    fs.access(filePath, fs.constants.R_OK, (err) => {
      if (err) {
        console.error("🚨 ERROR: File is not readable!", err);
      } else {
        console.log("✅ SUCCESS: File is readable.");
        
        // Try reading the file
        fs.readFile(filePath, (err, data) => {
          if (err) {
            console.error("🚨 ERROR: Cannot read file!", err);
          } else {
            console.log("✅ SUCCESS: File can be read.");
          }
        });
      }
    });
  }
});
