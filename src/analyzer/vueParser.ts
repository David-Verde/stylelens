import * as vscode from 'vscode';
import { parse, SFCDescriptor } from '@vue/compiler-sfc';
import { StyleUsage, InlineStyleUsage, normalizeStyleString } from './jsxParser';

function normalizeClassString(classString: string): string {
    return classString.trim().split(/\s+/).sort().join(' ');
}

function positionAt(offset: number, text: string): vscode.Position {
    const lines = text.substring(0, offset).split('\n');
    const line = lines.length - 1;
    const character = lines[lines.length - 1].length;
    return new vscode.Position(line, character);
}

export function findAllClassUsagesInVue(fileContent: string): StyleUsage[] {
    const { descriptor }: { descriptor: SFCDescriptor } = parse(fileContent);
    if (!descriptor.template) return [];

    const templateContent = descriptor.template.content;
    const templateOffset = descriptor.template.loc.start.offset;
    const allClassUsages: StyleUsage[] = [];
    const classRegex = /class="([^"]+)"/g;
    let match;

    while ((match = classRegex.exec(templateContent)) !== null) {
        if (match[1].trim() !== '') {
            const range = new vscode.Range(positionAt(templateOffset + match.index, fileContent), positionAt(templateOffset + match.index + match[0].length, fileContent));
            allClassUsages.push({ classString: normalizeClassString(match[1]), location: range });
        }
    }
    return allClassUsages;
}

export function findAllInlineStylesInVue(fileContent: string): InlineStyleUsage[] {
    const { descriptor }: { descriptor: SFCDescriptor } = parse(fileContent);
    if (!descriptor.template) return [];

    const templateContent = descriptor.template.content;
    const templateOffset = descriptor.template.loc.start.offset;
    const allInlineStyles: InlineStyleUsage[] = [];
    const styleRegex = /style="([^"]+)"/g;
    let match;

    while ((match = styleRegex.exec(templateContent)) !== null) {
        if (match[1].trim() !== '') {
            const range = new vscode.Range(positionAt(templateOffset + match.index, fileContent), positionAt(templateOffset + match.index + match[0].length, fileContent));
            allInlineStyles.push({ styleString: normalizeStyleString(match[1]), location: range });
        }
    }
    return allInlineStyles;
}

export function findDuplicateClassesInVue(fileContent: string): StyleUsage[] {
    const allUsages = findAllClassUsagesInVue(fileContent);
    const classCounts = new Map<string, number>();

    allUsages.forEach(usage => {
        const count = classCounts.get(usage.classString) || 0;
        classCounts.set(usage.classString, count + 1);
    });

    const duplicateClassStrings = new Set<string>();
    classCounts.forEach((count, classString) => { if (count > 1) duplicateClassStrings.add(classString); });

    return allUsages.filter(usage => duplicateClassStrings.has(usage.classString));
}