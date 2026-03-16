import { defineCollection, z } from "astro:content";

const projects = defineCollection({
  type: "content",
  schema: z.object({
    name: z.string(),
    status: z.enum(["active", "building", "archived"]),
    description: z.string(),
    url: z.string().url(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { projects };
