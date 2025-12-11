import { Project, Type, Node } from "ts-morph";
import * as path from "path";
import * as fs from "fs";
import { InterfaceDoc } from "../src/registry.types";

const IGNORED_TYPES = new Set(['Promise', 'Array']);

async function generateRegistry() {
    const project = new Project({
        tsConfigFilePath: path.resolve(__dirname, "../tsconfig.json"),
    });

    const sourceFiles = project.addSourceFilesAtPaths("src/endpoints/*.ts");
    console.log(`Found ${sourceFiles.length} endpoint files.`);

    const types: Record<string, InterfaceDoc> = {};
    const processedTypes = new Set<string>();
    let registryCommands = "";

    function processType(type: Type): void {
        if (type.isUnion()) {
            type.getUnionTypes().forEach(processType);
            return;
        }
        if (type.isArray()) {
            processType(type.getArrayElementTypeOrThrow());
            return;
        }

        const symbol = type.getSymbol() || type.getAliasSymbol();
        if (!symbol) return;

        const typeName = symbol.getName();
        if (processedTypes.has(typeName) || IGNORED_TYPES.has(typeName)) return;
        if (type.isString() || type.isNumber() || type.isBoolean()) return;
        if (type.getText() === 'any' || type.getText() === 'void') return;

        const declarations = symbol.getDeclarations();
        if (!declarations?.length) return;

        const sourceFile = declarations[0].getSourceFile();
        if (sourceFile.getFilePath().includes('node_modules')) return;

        processedTypes.add(typeName);

        const declaration = declarations[0];
        if (Node.isInterfaceDeclaration(declaration)) {
            types[typeName] = {
                name: typeName,
                description: getJsDocDescription(declaration.getJsDocs()),
                properties: declaration.getProperties().map(p => {
                    const propType = p.getType();
                    processType(propType);
                    return {
                        name: p.getName(),
                        type: propType.getText(p),
                        description: getJsDocDescription(p.getJsDocs()),
                        optional: p.hasQuestionToken()
                    };
                })
            };
        }
    }

    function getJsDocDescription(jsDocs: { getDescription(): string }[]): string | undefined {
        const desc = jsDocs.map(d => d.getDescription().trim()).join('\n');
        return desc || undefined;
    }

    function camelToSnake(str: string): string {
        return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    }

    for (const sourceFile of sourceFiles) {
        for (const iface of sourceFile.getInterfaces()) {
            if (!iface.getName().endsWith('Endpoint')) continue;
            console.log(`Processing Endpoint: ${iface.getName()}`);

            const jsDocs = iface.getJsDocs();
            let mountPath: string | undefined;
            let isFactory = false;
            const factoryParams: { name: string; type: string; description?: string }[] = [];

            for (const doc of jsDocs) {
                for (const tag of doc.getTags()) {
                    const tagName = tag.getTagName();
                    if (tagName === 'mountPath') {
                        mountPath = tag.getCommentText()?.trim();
                    } else if (tagName === 'factory') {
                        isFactory = true;
                    } else if (tagName === 'param') {
                        const match = tag.getText().match(/@param\s+\{([^}]+)\}\s+(\w+)\s*-\s*(.*)/);
                        if (match) {
                            factoryParams.push({ type: match[1], name: match[2], description: match[3] });
                        }
                    }
                }
            }

            if (!mountPath) continue;

            for (const method of iface.getMethods()) {
                const returnType = method.getReturnType();
                returnType.getTypeArguments().forEach(processType);

                const methodParams = method.getParameters().map(p => {
                    processType(p.getType());
                    return { name: p.getName(), type: p.getType().getText(p), optional: p.hasQuestionToken() };
                });

                // Build command
                const commandName = `${mountPath}_${camelToSnake(method.getName())}`;
                const allParams = [
                    ...factoryParams.map(fp => ({ ...fp, optional: false })),
                    ...methodParams
                ];

                const factoryArgsObj = factoryParams.map(fp => `${fp.name}: args.${fp.name}`).join(', ');
                const methodArgs = methodParams.map(mp => `args.${mp.name}`).join(', ');
                const methodCall = isFactory
                    ? `api.${mountPath}({ ${factoryArgsObj} }).${method.getName()}(${methodArgs})`
                    : `api.${mountPath}.${method.getName()}(${methodArgs})`;

                registryCommands += `    "${commandName}": {
        description: ${JSON.stringify(getJsDocDescription(method.getJsDocs()) || "")},
        parameters: ${JSON.stringify(allParams)},
        returnType: "${returnType.getText(method)}",
        execute: async (api: any, args: Record<string, any>) => {
            return ${methodCall};
        }
    },
`;
            }
        }
    }

    // Write output
    const templatePath = path.resolve(__dirname, "registry.ts.template");
    let content = fs.readFileSync(templatePath, "utf-8");
    content = content.replace("{{registry_content}}", registryCommands);
    content = content.replace("{{types_content}}", JSON.stringify(types, null, 4));

    const outputPath = path.resolve(__dirname, "../src/registry.ts");
    fs.writeFileSync(outputPath, content);
    console.log(`Registry generated at ${outputPath}`);
}

generateRegistry().catch(console.error);
