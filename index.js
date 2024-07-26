import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const prisma = new PrismaClient();
const clients = {}; // Object to keep track of clients and their sensorIds

io.on("connection", (socket) => {
  console.log("User Connected");

  // Listen for the event to get smokeLevel based on sensorId
  socket.on("getSmokeConcentration", async (sensorId) => {
    clients[socket.id] = sensorId; // Store the sensorId for this client

    try {
      // Query the database for the smoke Concentration of the given sensorId
      const lastReading = await prisma.lastReading.findUnique({
        where: { sensorId: sensorId },
        select: { smokeConcentration: true },
      });

      if (lastReading) {
        // Emit the smokeLevel back to the client
        console.log(lastReading.smokeConcentration);
        socket.emit("smokeConcentration", lastReading.smokeConcentration);
      } else {
        // Emit a message indicating no data was found
        socket.emit("error", `No data found for sensorId: ${sensorId}`);
      }
    } catch (error) {
      console.error("Error fetching smoke level:", error);
      socket.emit("error", "An error occurred while fetching the smoke level.");
    }
  });

  // Handle client disconnect
  socket.on("disconnect", () => {
    console.log("User Disconnected");
    delete clients[socket.id]; // Remove the client from the tracking object
  });
});

// Function to periodically check and emit smoke levels
const checkSmokeConcentration = async () => {
  for (const [socketId, sensorId] of Object.entries(clients)) {
    try {
      const lastReading = await prisma.lastReading.findUnique({
        where: { sensorId: sensorId },
        select: { smokeConcentration: true },
      });

      if (lastReading) {
        io.to(socketId).emit("smokeConcentration", lastReading.smokeConcentration);
      }
    } catch (error) {
      console.error("Error fetching smoke level for interval check:", error);
      io.to(socketId).emit("error", "An error occurred while fetching the smoke level.");
    }
  }
};

// Set interval to check smoke levels every 10 seconds (10000 ms)
setInterval(checkSmokeConcentration, 3000);

server.listen(8080, () => {
  console.log("server running at http://localhost:8080");
});
