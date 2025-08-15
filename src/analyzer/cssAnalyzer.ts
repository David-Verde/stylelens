import * as vscode from 'vscode';

export async function getAllDefinedCssClasses(): Promise<Set<string>> {
    const cssFiles = await vscode.workspace.findFiles('**/*.css', '**/node_modules/**');
    const definedClasses = new Set<string>();
    
    // Expresión regular para encontrar selectores de clase CSS.
    // Maneja clases simples (.clase), pseudo-clases (:hover), media queries, etc.
    const classRegex = /\.([a-zA-Z0-9_-]+)/g;

    for (const file of cssFiles) {
        try {
            const document = await vscode.workspace.openTextDocument(file);
            const content = document.getText();
            let match;
            while ((match = classRegex.exec(content)) !== null) {
                // match[1] contiene el nombre de la clase sin el punto.
                definedClasses.add(match[1]);
            }
        } catch (error) {
            console.error(`StyleLens: Error reading CSS file ${file.fsPath}`, error);
        }
    }

    return definedClasses;
}