class AudioCacheService {
    constructor() {
        // Nome da base de dados IndexedDB
        this.dbName = 'PianoDetectorAudioDB';
        // Versão da base de dados
        this.dbVersion = 1;
        // Nome do object store onde os dados serão armazenados
        this.storeName = 'recordings';
        // Tamanho máximo permitido para a cache (50 MB)
        this.maxCacheSize = 50 * 1024 * 1024;
    }

    // Método para abrir a base de dados IndexedDB
    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => resolve(request.result);

            // Caso seja necessário criar ou atualizar a estrutura da base de dados
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Cria o object store se ainda não existir
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    // Cria um índice para ordenar os registos por timestamp
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // Método para guardar um áudio na cache
    async saveAudioToCache(audioBlob, analysisId, notes) {
        try {
            const db = await this.openDB();

            // Converte o áudio para um ArrayBuffer
            const arrayBuffer = await audioBlob.arrayBuffer();

            // Cria o registo do áudio com os dados necessários
            const audioRecord = {
                id: analysisId,
                audioData: arrayBuffer,
                notes: notes,
                size: arrayBuffer.byteLength,
                timestamp: Date.now(),
                mimeType: audioBlob.type
            };

            // Limpa a cache se o tamanho máximo for excedido
            await this.cleanOldCacheIfNeeded(db);

            // Adiciona o registo à base de dados
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            await new Promise((resolve, reject) => {
                const request = store.put(audioRecord);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            console.log(`Áudio salvo em cache: ${analysisId}`);
            return analysisId;

        } catch (error) {
            console.warn('Erro ao salvar áudio em cache:', error);
            return null;
        }
    }

    // Método para carregar um áudio da cache
    async loadAudioFromCache(analysisId) {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            return new Promise((resolve, reject) => {
                const request = store.get(analysisId);
                request.onsuccess = () => {
                    if (request.result) {
                        // Converte os dados armazenados num Blob
                        const blob = new Blob([request.result.audioData], {
                            type: request.result.mimeType || 'audio/webm'
                        });
                        resolve(blob);
                    } else {
                        resolve(null);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.warn('Erro ao carregar áudio do cache:', error);
            return null;
        }
    }

    // Método para limpar registos antigos da cache, se necessário
    async cleanOldCacheIfNeeded(db) {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const index = store.index('timestamp');
        const request = index.getAll();

        return new Promise((resolve) => {
            request.onsuccess = () => {
                const records = request.result;
                // Calcula o tamanho total da cache
                let totalSize = records.reduce((sum, record) => sum + record.size, 0);

                // Se o tamanho total exceder o limite, remove registos mais antigos
                if (totalSize > this.maxCacheSize) {
                    records.sort((a, b) => a.timestamp - b.timestamp);

                    while (totalSize > this.maxCacheSize * 0.8 && records.length > 0) {
                        const oldRecord = records.shift();
                        store.delete(oldRecord.id);
                        totalSize -= oldRecord.size;
                    }
                }
                resolve();
            };
        });
    }
}

export default AudioCacheService;