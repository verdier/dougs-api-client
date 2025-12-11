import { Project, InterfaceDeclaration, Type, Symbol as MorphSymbol, Node } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

interface PropertyDoc {
    name: string;
    type: string;
    description?: string;
    optional: boolean;
}

interface InterfaceDoc {
    name: string;
    description?: string;
    properties: PropertyDoc[];
}

interface MethodParameterDoc {
    name: string;
    type: string;
    optional: boolean;
}

interface MethodDoc {
    name: string;
    description?: string;
    parameters: MethodParameterDoc[];
    returnType: string;
}

interface EndpointDoc {
    name: string;
    description?: string;
    methods: MethodDoc[];
}

interface Documentation {
    endpoints: EndpointDoc[];
    types: { [name: string]: InterfaceDoc };
}

async function generateDocs() {
    const project = new Project({
        tsConfigFilePath: path.resolve(__dirname, "../../tsconfig.json"),
    });

    const endpointsPattern = "src/endpoints/*.ts";
    const sourceFiles = project.addSourceFilesAtPaths(endpointsPattern);

    // also add client.ts as it might be referenced, though maybe not needed for DTOs
    project.addSourceFileAtPath("src/client.ts");

    console.log(`Found ${sourceFiles.length} endpoint files.`);

    const doc: Documentation = {
        endpoints: [],
        types: {}
    };

    const processedTypes = new Set<string>();

    function processType(type: Type) {
        // Handle union types: unwrap
        if (type.isUnion()) {
            for (const unionType of type.getUnionTypes()) {
                processType(unionType);
            }
            return;
        }

        const symbol = type.getSymbol() || type.getAliasSymbol();
        if (!symbol) {
            return;
        }

        const typeName = symbol.getName();

        if (processedTypes.has(typeName) ||
            typeName === 'Promise' ||
            typeName === 'Array' ||
            type.isString() ||
            type.isNumber() ||
            type.isBoolean() ||
            type.getText() === 'any' ||
            type.getText() === 'void') return;

        // Filter out standard lib types if possible, or verify it's from our source
        const declarations = symbol.getDeclarations();
        if (!declarations || declarations.length === 0) {
            return;
        }

        const sourceFile = declarations[0].getSourceFile();
        if (sourceFile.getFilePath().includes('node_modules')) return;

        if (processedTypes.has(typeName)) return;
        processedTypes.add(typeName);

        // Handle array types: unwrap (though usually handled before if it was direct array)
        if (type.isArray()) {
            processType(type.getArrayElementType()!);
            return;
        }

        // We mainly care about Interfaces for DTOs
        const declaration = declarations[0];
        if (Node.isInterfaceDeclaration(declaration)) {
            const properties: PropertyDoc[] = declaration.getProperties().map(p => {
                const propType = p.getType();
                // Recursively process property types
                processType(propType);

                // special handling for arrays in properties
                if (propType.isArray()) {
                    processType(propType.getArrayElementType()!);
                }

                return {
                    name: p.getName(),
                    type: propType.getText(p), // Use text representation for now
                    description: p.getJsDocs().map(doc => doc.getDescription().trim()).join('\n') || undefined,
                    optional: p.hasQuestionToken()
                };
            });

            doc.types[typeName] = {
                name: typeName,
                description: declaration.getJsDocs().map(doc => doc.getDescription().trim()).join('\n') || undefined,
                properties
            };
        }
        // TODO: Handle Enum or TypeAlias if needed
    }

    for (const sourceFile of sourceFiles) {
        const interfaces = sourceFile.getInterfaces();

        for (const interfaceDec of interfaces) {
            if (interfaceDec.getName().endsWith('Endpoint')) {
                console.log(`Processing Endpoint: ${interfaceDec.getName()}`);

                const methods: MethodDoc[] = interfaceDec.getMethods().map(m => {
                    const returnType = m.getReturnType();

                    // Expect Promise<T>
                    const typeArgs = returnType.getTypeArguments();
                    if (typeArgs.length > 0) {
                        const innerType = typeArgs[0];
                        processType(innerType);
                        if (innerType.isArray()) {
                            processType(innerType.getArrayElementType()!);
                        }
                    }

                    return {
                        name: m.getName(),
                        description: m.getJsDocs().map(doc => doc.getDescription().trim()).join('\n') || undefined,
                        parameters: m.getParameters().map(p => {
                            const paramType = p.getType();
                            processType(paramType);
                            return {
                                name: p.getName(),
                                type: paramType.getText(p),
                                optional: p.hasQuestionToken()
                            };
                        }),
                        returnType: returnType.getText(m)
                    };
                });

                doc.endpoints.push({
                    name: interfaceDec.getName(),
                    description: interfaceDec.getJsDocs().map(d => d.getDescription().trim()).join('\n') || undefined,
                    methods
                });
            }
        }
    }

    const outputPath = path.resolve(__dirname, "../../docs.json");
    fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2));
    console.log(`Documentation generated at ${outputPath}`);
}

generateDocs().catch(console.error);
