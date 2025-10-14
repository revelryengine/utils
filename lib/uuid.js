const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/**
 * Creates a randomly generated UUID v4 string in the xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx format.
 */
export function UUID () {
    return crypto.randomUUID();
}

/**
 * Converts a Uint8Array byte array to the UUID v4 format string
 * @param {Uint8Array} bytes - The byte array to convert
 */
UUID.fromBytes = (bytes) => {
    const u = [...bytes].map(b => b.toString(16).padStart(2, '0'));
    return `${u[0]}${u[1]}${u[2]}${u[3]}-${u[4]}${u[5]}-${u[6]}${u[7]}-${u[8]}${u[9]}-${u[10]}${u[11]}${u[12]}${u[13]}${u[14]}${u[15]}`;
}

/**
 * Converts a UUID v4 format string to a byte array
 * @param {string} hex - The string to convert
 */
UUID.toBytes = (hex) => {
    const matches = hex.replace(/-/g, '').match(/.{1,2}/g);
    if(!matches || matches.length !== 16) throw new Error('Invalid UUID');
    return new Uint8Array(matches.map(u => parseInt(u, 16)));
}

/**
 * Returns true if string is in valid UUID v4 format.
 * @param {string} string
 */
UUID.isUUID = (string) => {
    return UUID_REGEX.test(string);
}
