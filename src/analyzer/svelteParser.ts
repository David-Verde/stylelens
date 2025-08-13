
import * as vscode from 'vscode';
import { parse } from 'svelte/compiler';
import { walk } from 'estree-walker'; 
import { StyleUsage } from './jsxParser';

function normalizeClassString(classString: string): string {
    return classString.trim().split(/\s+/).sort().join(' ');
}

// Volvemos a la versión SÍNCRONA. No más async/await aquí.
export function findDuplicateClassesInSvelte(document: vscode.TextDocument): StyleUsage[] {
    const fileContent = document.getText();
    try {
        const ast = parse(fileContent);
        const allClassUsages: StyleUsage[] = [];
        const classCounts = new Map<string, number>();

        // La llamada a walk sobre ast.html es correcta
        if (ast.html) {
            walk(ast.html as any, {
                enter(node: any) {
                    if (node.type === 'Attribute' && node.name === 'class') {
                        if (node.value && node.value.length === 1 && node.value[0].type === 'Text') {
                            const classString = node.value[0].data;
                            const normalizedClassString = normalizeClassString(classString);

                            const startPos = document.positionAt(node.start);
                            const endPos = document.positionAt(node.end);
                            const range = new vscode.Range(startPos, endPos);

                            allClassUsages.push({ classString: normalizedClassString, location: range });

                            const count = classCounts.get(normalizedClassString) || 0;
                            classCounts.set(normalizedClassString, count + 1);
                        }
                    }
                }
            });
        }
        
        const duplicateClassStrings = new Set<string>();
        classCounts.forEach((count, classString) => {
            if (count > 1) {
                duplicateClassStrings.add(classString);
            }
        });

        return allClassUsages.filter(usage => duplicateClassStrings.has(usage.classString));

    } catch (error: any) {
        console.error("StyleLens: Error parsing Svelte file.", { message: error.message });
        return [];
    }
}