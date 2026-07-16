import { generateUUID } from "./utils";


export const PERMISSION_ACTIONS = {
    ADD: 'add',
    UPDATE: 'update',
    DELETE: 'delete',
    VIEW: 'view',
    RESTORE: 'restore',
};

export const BLANK = '';

export const RATE_TYPE = [
    {
        id: generateUUID(),
        value: 'hr',
        label: 'Hourly'
    },
    {
        id: generateUUID(),
        value: 'day',
        label: 'Daily'
    }
]