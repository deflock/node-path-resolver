import nodepath from 'path';

/**
 * @param {*} x
 * @returns {boolean}
 */
function isFunction(x) {
    return typeof x === 'function';
}

/**
 *
 */
export default class PathResolver {
    /**
     * @param {Object} options
     */
    constructor(options = {}) {
        this.options = options;
        this.namespaces = options.namespaces || {};
        this.aliases = options.aliases || {};
        this.basedir = options.basedir ? nodepath.resolve(options.basedir) : null;
    }

    /**
     * @param {string} path
     * @param {string|null} from
     * @param {string|Array|boolean} aliases
     * @param {Object} options
     * @returns {string|null}
     */
    absolute(path, from = null, aliases = true, options = {}) {
        return this.resolve(path, from, aliases, options);
    }

    /**
     * @param {string} path
     * @param {string|null} from
     * @param {string|Array|boolean} aliases
     * @param {Object} options
     * @returns {string|null}
     */
    relative(path, from = null, aliases = true, options = {}) {
        const {
            isFromDir = true,
        } = options;

        return this.doRelative(
            path,
            from,
            aliases,
            options,
            from ? (isFromDir ? from : nodepath.dirname(from)) : (this.basedir || '')
        );
    }

    /**
     * @param {string} path
     * @param {string|null} from
     * @param {string|Array|boolean} aliases
     * @param {Object} options
     * @returns {string|null}
     */
    relativeToBasedir(path, from = null, aliases = true, options = {}) {
        return this.doRelative(path, from, aliases, options, this.basedir || '');
    }

    /**
     * @param {string} path
     * @param {string} from
     * @param {string|Array|boolean} aliases
     * @param {Object} options
     * @param {string} base
     * @returns {string|null}
     */
    doRelative(path, from, aliases, options, base) {
        const {
            prependDot = false,
        } = options;

        const absolute = this.resolve(path, from, aliases, options);

        if (absolute == null) {
            return null;
        }

        const relative = nodepath.relative(nodepath.resolve(this.basedir || '', base), absolute);

        return relative[0] !== '.' && prependDot ? `./${relative}` : relative;
    }

    /**
     * @param {string} path
     * @param {string} from
     * @param {string|Array|boolean} aliases
     * @param {Object} options
     * @returns {string|null}
     */
    resolve(path, from, aliases, options = {}) {
        const {
            isFromDir = true,
        } = options;

        let resolved;

        if (path[0] === '.') {
            resolved = this.resolveDotPath(path, from, isFromDir);
        }
        else {
            resolved = this.resolveNonDotPath(path, from, isFromDir);
        }

        if (resolved == null) {
            return null;
        }

        if (aliases === false) {
            return resolved;
        }

        const types = Array.isArray(aliases) ? aliases : [aliases];

        for (const type of types) {
            const aliasResolved = this.resolveAlias(resolved, type === true ? null : type, options);
            if (aliasResolved !== null) {
                return aliasResolved;
            }
        }

        return resolved;
    }

    /**
     * @param {string} path
     * @param {string} from
     * @param {boolean} isFromDir
     * @returns {string|null}
     */
    resolveDotPath(path, from, isFromDir = true) {
        if (from == null || from === '') {
            return nodepath.resolve(path);
        }
        return isFromDir
            ? nodepath.resolve(this.basedir || '', from, path)
            : nodepath.resolve(this.basedir || '', nodepath.dirname(from), path);
    }

    /**
     * @param {string} path
     * @param {string} from
     * @param {boolean} isFromDir
     * @returns {string|null}
     */
    resolveNonDotPath(path, from, isFromDir = true) {
        if (path.indexOf('::') > -1) {
            // namespace::relative/path -> namespace/path/relative/path
            return nodepath.resolve(this.basedir || '', this.resolveNamespace(path, from));
        }
        else {
            // todo some/path -> node_modules/some/path ?
            return path;
        }
    }

    /**
     * Namespaces: pages, mails
     *
     * pages/path/to/file.ext + ::relative/to/ns       ->  pages/relative/to/ns
     * pages/path/to/file.ext + mails::relative/to/ns  ->  mails/relative/to/ns
     *
     * @param {string} path
     * @param {string} from
     * @returns {string}
     */
    resolveNamespace(path, from) {
        const rawNamespaces = isFunction(this.namespaces) ? this.namespaces() : this.namespaces;
        const namespaces = Object.assign(...Object.entries(rawNamespaces).map(
            ([ns, nspath]) => {
                return {[ns]: nodepath.resolve(this.basedir || '', nspath === true ? ns : nspath)};
            },
        ));

        const nsDelimiterPos = path.indexOf('::');

        if (nsDelimiterPos === -1) {
            throw new Error('Path does not contain namespace separator "::"');
        }

        let basedir;
        let replaceString;

        if (nsDelimiterPos === 0) {
            /*
             * path/to/file.ext + ::relative/to/ns
             * Find namespace by the `from` parameter and then resolve path relative to it
             */

            if (from == null || from === '') {
                throw new Error('Parameter "from" must be a non-empty string');
            }
            else if (typeof from !== 'string') {
                // eslint-disable-next-line no-param-reassign
                from = from.toString();
            }

            from = nodepath.resolve(this.basedir || '', from);

            let maxLenNsPath = '';

            for (const ns of Object.keys(namespaces)) {
                if (from.indexOf(namespaces[ns]) === 0 && namespaces[ns].length > maxLenNsPath.length) {
                    maxLenNsPath = namespaces[ns];
                }
            }

            replaceString = '::';
            basedir = maxLenNsPath;
        }
        else {
            /*
             * path/to/file.ext + namespace::relative/to/ns
             */

            const ns = path.substr(0, nsDelimiterPos);

            if (!Object.prototype.hasOwnProperty.call(namespaces, ns)) {
                throw new Error(`Namespace "${ns}" not found`);
            }

            replaceString = `${ns}::`;
            basedir = namespaces[ns];
        }

        return nodepath.join(basedir, path.replace(replaceString, ''));
    }

    /**
     * Resolve alias using aliases map
     *
     * @param {string} path
     * @param {string|null} type
     * @param {Object} options
     *
     * @returns {string|null}
     */
    resolveAlias(path, type, options = {}) {
        const {
            recursive = true,
            aliases = isFunction(this.aliases) ? this.aliases() : this.aliases,
        } = options;

        let resolved;

        if (type == null) {
            for (const t of Object.keys(aliases)) {
                resolved = this.resolveAlias(path, t, Object.assign({}, options, {
                    aliases,
                }));

                if (resolved !== null) {
                    return resolved;
                }
            }
            return null;
        }

        if (!aliases[type]) {
            return null;
        }

        const oppositeSlash = nodepath.sep === '/' ? '\\' : '/';
        let aliasFound;

        resolved = nodepath.resolve(this.basedir || '', path);

        for (let index = 0; index < 1000; index++) {
            const testPaths = [
                resolved,
                resolved.replace(/[\\/]+/g, oppositeSlash),
            ];

            if (this.basedir && resolved.indexOf(this.basedir) === 0) {
                testPaths.push(
                    nodepath.relative(this.basedir, resolved),
                    nodepath.relative(this.basedir, resolved).replace(/[\\/]+/g, oppositeSlash),
                );
            }

            aliasFound = false;

            for (const p of testPaths) {
                if (Object.prototype.hasOwnProperty.call(aliases[type], p)) {
                    resolved = nodepath.resolve(this.basedir || '', aliases[type][p]);
                    aliasFound = true;
                    break;
                }
            }

            if (!aliasFound) {
                return index === 0 ? null : resolved;
            }

            if (index === 0 && !recursive) {
                return resolved;
            }
        }

        throw new Error('Infinite loop detected while resolving aliases');
    }

    /**
     * @param {Object|Function} namespaces
     * @return {PathResolver}
     */
    setNamespaces(namespaces) {
        this.namespaces = namespaces;
        return this;
    }

    /**
     * @param {Object|Function} aliases
     * @return {PathResolver}
     */
    setAliases(aliases) {
        this.aliases = aliases;
        return this;
    }
}
