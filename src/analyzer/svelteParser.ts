import * as vscode from 'vscode';
import { parse, walk } from 'svelte/compiler';
import { StyleUsage } from './jsxParser';

function normalizeClassString(classString: string): string {
    return classString.trim().split(/\s+/).sort().join(' ');
}

export function findDuplicateClassesInSvelte(document: vscode.TextDocument): StyleUsage[] {
    const fileContent = document.getText();
    try {
        const ast = parse(fileContent);
        const allClassUsages: StyleUsage[] = [];
        const classCounts = new Map<string, number>();

        for (const node of walk(ast.html)) {
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

        const duplicateClassStrings = new Set<string>();
        classCounts.forEach((count, classString) => {
            if (count > 1) {
                duplicateClassStrings.add(classString);
            }
        });

        return allClassUsages.filter(usage => duplicateClassStrings.has(usage.classString));
    } catch (error) {
        console.error("StyleLens: Error parsing Svelte file.", error);
        return [];
    }
}
