import * as vscode from 'vscode';
import { parse, SFCDescriptor } from '@vue/compiler-sfc';


import { StyleUsage } from './jsxParser';

function normalizeClassString(classString: string): string {
    return classString.trim().split(/\s+/).sort().join(' ');
}


function positionAt(offset: number, text: string): vscode.Position {
    const lines = text.substring(0, offset).split('\n');
    const line = lines.length - 1;
    const character = lines[lines.length - 1].length;
    return new vscode.Position(line, character);
}

export function findDuplicateClassesInVue(fileContent: string): StyleUsage[] {

    const { descriptor }: { descriptor: SFCDescriptor } = parse(fileContent);

    if (!descriptor.template) {
        return [];
    }

    const templateContent = descriptor.template.content;
    const templateOffset = descriptor.template.loc.start.offset;
    const allClassUsages: StyleUsage[] = [];
    const classCounts = new Map<string, number>();

    const classRegex = /class="([^"]+)"/g;
    let match;

    while ((match = classRegex.exec(templateContent)) !== null) {
        const classString = match[1];
        const normalizedClassString = normalizeClassString(classString);


        const startOffset = templateOffset + match.index;
        const endOffset = startOffset + match[0].length;

        const range = new vscode.Range(
            positionAt(startOffset, fileContent),
            positionAt(endOffset, fileContent)
        );

        allClassUsages.push({ classString: normalizedClassString, location: range });

        const count = classCounts.get(normalizedClassString) || 0;
        classCounts.set(normalizedClassString, count + 1);
    }
    
    const duplicateClassStrings = new Set<string>();
    classCounts.forEach((count, classString) => {
        if (count > 1) {
            duplicateClassStrings.add(classString);
        }
    });

    return allClassUsages.filter(usage => duplicateClassStrings.has(usage.classString));
}