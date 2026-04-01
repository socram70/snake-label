// vite.config.singlefile.js
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const mimeTypes = {
    svg: 'image/svg+xml',
    png: 'image/png',
    webp: 'image/webp',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
}

function inlinePublicImages() {
    return {
        name: 'inline-public-images',
        transformIndexHtml: {
            order: 'pre',
            handler(html) {
                return html.replace(
                    /src="((?!data:)[^"]+\.(svg|png|webp|jpg|jpeg))"/g,
                    (match, src) => {
                        try {
                            const content = readFileSync(resolve(process.cwd(), 'public', src))
                            const ext = src.split('.').pop()
                            return `src="data:${mimeTypes[ext]};base64,${content.toString('base64')}"`
                        } catch {
                            return match
                        }
                    }
                )
            }
        }
    }
}

export default defineConfig({
    build: {},
    css: {
        postcss: {
            plugins: [
                require('tailwindcss'),
                require('autoprefixer'),
            ],
        }
    },
    plugins: [inlinePublicImages(), viteSingleFile()],
})