import http from "http";

const invoiceId = "c5cdb9fd-840b-4905-92b3-4241e063690d";

http.get(`http://127.0.0.1:3000/faktura/${invoiceId}`, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    if (res.statusCode === 200) {
      console.log("Page loaded OK");
      console.log("Contains FAK-0001:", data.includes("FAK-0001"));
      console.log("Contains Skriv ut:", data.includes("Skriv ut"));
      console.log("Contains error:", data.includes("error") || data.includes("Error"));
    } else {
      console.log("Response (first 2000 chars):", data.slice(0, 2000));
    }
  });
}).on("error", (e) => console.error("Request error:", e.message));

setTimeout(() => process.exit(0), 10000);
