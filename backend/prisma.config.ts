import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma", // <-- Change this to include the folder path
  datasource: {
    url: process.env.DATABASE_URL,
  },
});