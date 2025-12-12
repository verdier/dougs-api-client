export interface CommandParameter {
    name: string;
    type: string;
    description?: string;
    optional: boolean;
}

export interface Command {
    description?: string;
    parameters: Record<string, CommandParameter>;
    returnType: string;
    execute: (api: any, args: Record<string, any>) => Promise<any>;
}

export interface PropertyDoc {
    name: string;
    type: string;
    description?: string;
    optional: boolean;
}

export interface InterfaceDoc {
    name: string;
    description?: string;
    properties: PropertyDoc[];
}
