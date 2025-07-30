import * as vscode from 'vscode';
import * as path from 'path';


const TARGET_STYLE_FILES = [
    // Next.js
    '**/src/app/global.css',
    '**/src/styles/globals.css',
    '**/app/global.css',
    
    // Vite/React
    '**/src/main.css',
    '**/src/App.css',
    
    // Angular
    '**/src/styles.css',
    
    // Vue
    '**/src/assets/styles.css',
    '**/src/assets/main.css',
    
    // Astro
    '**/src/styles/global.css',
    
    // Common patterns
    '**/src/global.css',
    '**/src/styles/global.css',
    '**/src/index.css',
    '**/src/app.css',
    '**/styles.css',
    '**/assets/css/main.css',
    '**/public/styles.css',
    '**/dist/styles.css',
    
    // CSS-in-JS fallbacks
    '**/src/theme.js',
    '**/src/theme.ts',
    '**/src/styles/theme.js',
    
    // Tailwind special cases
    '**/tailwind.config.js',
    '**/src/tailwind.css',
    '**/src/styles/tailwind.css',
    
    // CSS Modules fallback
    '**/src/**/*.module.css'
];

/**
 * @returns 
 */
export async function findTargetCssFile(): Promise<vscode.Uri | undefined> {
    for (const pattern of TARGET_STYLE_FILES) {
       
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);
        if (files.length > 0) {
            return files[0];
        }
    }
    return undefined;
}

/**
 * @param fileUri 
 * @param content 
 */
export async function appendToFile(fileUri: vscode.Uri, content: string): Promise<void> {
    try {
        const originalContent = await vscode.workspace.fs.readFile(fileUri);
        const newContent = Buffer.concat([originalContent, Buffer.from(content)]);
        await vscode.workspace.fs.writeFile(fileUri, newContent);
    } catch (error) {
        console.error(`StyleLens: Error al escribir en el archivo ${fileUri.fsPath}`, error);
        vscode.window.showErrorMessage(`No se pudo escribir en el archivo de estilos: ${fileUri.fsPath}`);
    }
}