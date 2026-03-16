import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

export default defineConfig({
	site: "https://gramajo.xyz",
	output: "static",
	integrations: [mdx()],
});
