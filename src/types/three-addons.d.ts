declare module "three/addons/loaders/STLLoader.js" {
    import * as THREE from "three";
    export class STLLoader {
        load(
            url: string,
            onLoad: (geometry: THREE.BufferGeometry) => void,
            onProgress?: (event: ProgressEvent) => void,
            onError?: (event: ErrorEvent) => void
        ): void;
        parse(data: ArrayBuffer): THREE.BufferGeometry;
    }
}

declare module "three/addons/loaders/OBJLoader.js" {
    import * as THREE from "three";
    export class OBJLoader {
        load(
            url: string,
            onLoad: (object: THREE.Group) => void,
            onProgress?: (event: ProgressEvent) => void,
            onError?: (event: ErrorEvent) => void
        ): void;
        parse(data: string): THREE.Group;
    }
}
