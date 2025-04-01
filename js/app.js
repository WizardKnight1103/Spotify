if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('../sw.js')
            .then((registration) => {
                console.log('Service Worker registrado', registration.scope);

                // Solicita permiso para las notificaciones al cargar la página
                if (Notification.permission === "default") {
                    Notification.requestPermission().then(permission => {
                        if (permission === "granted") {
                            registration.active?.postMessage({ type: 'SHOW_NOTIFICATION' });
                        }
                    });
                } else if (Notification.permission === "granted") {
                    registration.active?.postMessage({ type: 'SHOW_NOTIFICATION' });
                }
            })
            .catch((error) => {
                console.log('Error al registrar el Service Worker:', error);
            });
    });
}

const API_KEY = "909ca5f8cfmshdaf197eeb44407cp10664fjsnbeb6852ee9a4";
const API_HOST = "spotify23.p.rapidapi.com";

// Variables globales
let searchResults = {
    songs: [],
    artists: []
};

let currentAudio = null;
let currentPlayingButton = null;

// Función para reproducir previews
function playPreview(previewUrl, button) {
    if (!previewUrl) {
        showNotification("Esta melodía no tiene vista previa disponible.", "error");
        return;
    }

    if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
        currentPlayingButton.innerHTML = '<i class="fas fa-play"></i> Escuchar';
    }

    if (!currentAudio || currentAudio.src !== previewUrl) {
        currentAudio = new Audio(previewUrl);
        currentPlayingButton = button;
        
        currentAudio.play()
            .then(() => {
                button.innerHTML = '<i class="fas fa-pause"></i> Pausar';
                showNotification("Reproduciendo vista previa...", "success");
            })
            .catch(error => {
                console.error("Error al reproducir:", error);
                showNotification("No se pudo iniciar la vista previa.", "error");
            });

        currentAudio.onended = () => {
            button.innerHTML = '<i class="fas fa-play"></i> Escuchar';
            currentAudio = null;
            currentPlayingButton = null;
        };
    } else {
        currentAudio = null;
        currentPlayingButton = null;
    }
}

// Mostrar notificación estilizada
function showNotification(message, type = "info") {
    const colors = {
        success: "#4fc1e9",
        error: "#e9546b",
        info: "#9c27b0"
    };
    
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.innerHTML = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background-color: ${colors[type] || colors.info};
        color: white;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = "slideOut 0.3s ease-in";
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Funciones auxiliares
function getOptimizedImageUrl(url, width = 150) {
    if (!url) return `https://via.placeholder.com/${width}`;
    if (url.includes('via.placeholder.com')) return url.replace(/\d+$/, width);
    return url;
}

function formatDuration(ms) {
    if (!ms) return "0:00";
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Búsqueda principal
async function searchMusic() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) {
        showNotification("Por favor, ingresa un término de búsqueda.", "error");
        return;
    }

    const url = `https://${API_HOST}/search/?q=${encodeURIComponent(query)}&type=multi&offset=0&limit=10&numberOfTopResults=5`;
    const options = {
        method: "GET",
        headers: {
            "x-rapidapi-key": API_KEY,
            "x-rapidapi-host": API_HOST
        }
    };

    try {
        document.getElementById("resultsContainer").innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-hydro" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
                <p class="mt-3">Buscando en el Reino de Fontaine...</p>
            </div>
        `;
        
        const response = await fetch(url, options);
        const data = await response.json();
        
        searchResults.songs = data.tracks?.items || [];
        searchResults.artists = data.artists?.items || [];

        if (searchResults.songs.length > 0) showResults("songs");
        else if (searchResults.artists.length > 0) showResults("artists");
        else showNoResults();
        
    } catch (error) {
        console.error("Error en la búsqueda:", error);
        document.getElementById("resultsContainer").innerHTML = `
            <div class="alert alert-hydro">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error al buscar: ${error.message}
            </div>
        `;
    }
}

// Mostrar resultados
function showResults(type) {
    const container = document.getElementById("resultsContainer");
    container.innerHTML = "";

    if (type === "songs") {
        showSongsResults();
    } else if (type === "artists") {
        showArtistsResults();
    }
}

// Melodías
async function showSongsResults() {
    const container = document.getElementById("resultsContainer");
    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-hydro" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-3">Preparando las melodías de Fontaine...</p>
        </div>
    `;

    if (searchResults.songs.length === 0) {
        container.innerHTML = `
            <div class="alert alert-hydro">
                <i class="fas fa-music me-2"></i>
                No se encontraron melodías
            </div>
        `;
        return;
    }

    // Obtener IDs de los tracks para buscar los preview_url
    const trackIds = searchResults.songs.map(song => song.data.id).join(',');
    const url = `https://${API_HOST}/tracks/?ids=${trackIds}`;
    const options = {
        method: "GET",
        headers: {
            "x-rapidapi-key": API_KEY,
            "x-rapidapi-host": API_HOST
        }
    };

    try {
        const response = await fetch(url, options);
        const tracksData = await response.json();

        // Mapear preview_url a cada canción
        const tracksWithPreviews = tracksData.tracks.reduce((acc, track) => {
            acc[track.id] = track.preview_url;
            return acc;
        }, {});

        // Generar HTML con los previews
        let html = '<h3 class="mb-4 text-fontaine"><i class="fas fa-music me-2"></i>Melodías de Fontaine</h3><div class="row row-cols-1 row-cols-md-3 g-4">';
        
        searchResults.songs.forEach(song => {
            const track = song.data;
            const previewUrl = tracksWithPreviews[track.id];
            const coverArtUrl = getOptimizedImageUrl(track.albumOfTrack?.coverArt?.sources?.[0]?.url);
            const artistNames = track.artists?.items?.map(artist => artist.profile?.name).join(", ") || "Artista desconocido";
            const spotifyUrl = `https://open.spotify.com/track/${track.id}`;

            html += `
                <div class="col">
                    <div class="card h-100 card-hydro">
                        <img src="${coverArtUrl}" class="card-img-top img-square" alt="Portada">
                        <div class="card-body">
                            <h6 class="card-title">${track.name || "Melodía desconocida"}</h6>
                            <p class="card-text small text-hydro-light">${artistNames}</p>
                        </div>
                        <div class="card-footer bg-transparent border-top-hydro">
                            <div class="d-flex gap-2">
                                <a href="${spotifyUrl}" target="_blank" class="btn btn-sm btn-outline-hydro flex-grow-1">
                                    <i class="fas fa-external-link-alt me-1"></i> Abrir
                                </a>
                                <button onclick="playPreview('${previewUrl}', this)" 
                                        ${!previewUrl ? 'disabled' : ''} 
                                        class="btn btn-sm btn-hydro flex-grow-1">
                                    ${previewUrl ? '<i class="fas fa-play me-1"></i> Escuchar' : '<i class="fas fa-ban me-1"></i> No disponible'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html + '</div>';
    } catch (error) {
        console.error("Error al obtener previews:", error);
        container.innerHTML = `
            <div class="alert alert-hydro">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error al cargar las melodías
            </div>
        `;
    }
}

// Compositores
function showArtistsResults() {
    const container = document.getElementById("resultsContainer");
    
    if (searchResults.artists.length === 0) {
        container.innerHTML = `
            <div class="alert alert-hydro">
                <i class="fas fa-user me-2"></i>
                No se encontraron compositores
            </div>
        `;
        return;
    }

    let html = '<h3 class="mb-4 text-fontaine"><i class="fas fa-mask me-2"></i>Compositores de Fontaine</h3><div class="row row-cols-1 row-cols-md-3 g-4">';
    
    searchResults.artists.forEach(artist => {
        const artistData = artist.data;
        const imgSrc = getOptimizedImageUrl(artistData.visuals?.avatarImage?.sources?.[0]?.url);
        const artistName = artistData.profile?.name || "Compositor desconocido";
        const artistId = artistData.uri.split(':')[2];

        html += `
            <div class="col">
                <div class="card h-100 card-hydro">
                    <img src="${imgSrc}" class="card-img-top img-square" alt="Imagen del compositor">
                    <div class="card-body text-center">
                        <h6 class="card-title">${artistName}</h6>
                    </div>
                    <div class="card-footer bg-transparent border-top-hydro">
                        <div class="d-flex flex-column gap-2">
                            <button onclick="getArtistAlbums('${artistId}', '${artistName}')" 
                                    class="btn btn-hydro-outline w-100">
                                <i class="fas fa-compact-disc me-1"></i> Partituras
                            </button>
                            <button onclick="getArtistTopSongs('${artistId}', '${artistName}')" 
                                    class="btn btn-hydro w-100">
                                <i class="fas fa-music me-1"></i> Obras Populares
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
    
    container.innerHTML = html + '</div>';
}

// Partituras de compositor
async function getArtistAlbums(artistId, artistName) {
    const container = document.getElementById("resultsContainer");
    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-hydro" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-3">Buscando partituras en los archivos de la Corte...</p>
        </div>
    `;

    try {
        const url = `https://${API_HOST}/artist_albums/?id=${artistId}&offset=0&limit=50`;
        const options = {
            method: "GET",
            headers: {
                "x-rapidapi-key": API_KEY,
                "x-rapidapi-host": API_HOST
            }
        };

        const response = await fetch(url, options);
        const data = await response.json();

        let html = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h3 class="text-fontaine"><i class="fas fa-compact-disc me-2"></i>Partituras de ${artistName}</h3>
                <button onclick="showResults('artists')" class="btn btn-hydro-outline">
                    <i class="fas fa-arrow-left me-1"></i> Volver
                </button>
            </div>
            <div class="row row-cols-1 row-cols-md-3 g-4">
        `;

        if (data.data?.artist?.discography?.albums?.items) {
            const albums = data.data.artist.discography.albums.items;
            
            albums.forEach(item => {
                const album = item.releases.items[0];
                const coverArtUrl = getOptimizedImageUrl(album.coverArt?.sources?.[0]?.url);
                const albumId = album.id;
                const releaseYear = album.date?.year || "Año desconocido";

                html += `
                    <div class="col">
                        <div class="card h-100 card-hydro">
                            <img src="${coverArtUrl}" class="card-img-top" alt="Portada de partitura">
                            <div class="card-body">
                                <h5 class="card-title">${album.name || "Partitura desconocida"}</h5>
                                <p class="card-text text-hydro-light">${releaseYear}</p>
                            </div>
                            <div class="card-footer bg-transparent border-top-hydro">
                                <button onclick="getAlbumTracks('${albumId}', '${artistName}', '${artistId}')" 
                                        class="btn btn-hydro w-100">
                                    <i class="fas fa-music me-1"></i> Ver Melodías
                                </button>
                            </div>
                        </div>
                    </div>`;
            });
        }

        container.innerHTML = html + '</div>';
    } catch (error) {
        console.error("Error al obtener partituras:", error);
        container.innerHTML = `
            <div class="alert alert-hydro">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error: ${error.message}
                <button onclick="showResults('artists')" class="btn btn-hydro-outline mt-3">
                    <i class="fas fa-arrow-left me-1"></i> Volver
                </button>
            </div>
        `;
    }
}

// Función para obtener obras populares del compositor (CON IMÁGENES DE ÁLBUM)
async function getArtistTopSongs(artistId, artistName) {
    const container = document.getElementById("resultsContainer");
    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-hydro" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-3">Consultando las obras más populares en la Corte de Fontaine...</p>
        </div>
    `;

    try {
        // Primero obtenemos los álbumes del artista
        const albumsUrl = `https://${API_HOST}/artist_albums/?id=${artistId}&offset=0&limit=5`;
        const options = {
            method: "GET",
            headers: {
                "x-rapidapi-key": API_KEY,
                "x-rapidapi-host": API_HOST
            }
        };

        const albumsResponse = await fetch(albumsUrl, options);
        const albumsData = await albumsResponse.json();

        if (!albumsData.data?.artist?.discography?.albums?.items || albumsData.data.artist.discography.albums.items.length === 0) {
            container.innerHTML = `
                <div class="alert alert-hydro">
                    <i class="fas fa-music me-2"></i>
                    No se encontraron obras populares para este compositor.
                </div>
            `;
            return;
        }

        // Obtenemos los tracks de los primeros álbumes
        let allTracks = [];
        const albums = albumsData.data.artist.discography.albums.items.slice(0, 3); // Limitar a 3 álbumes para no saturar

        for (const albumItem of albums) {
            const album = albumItem.releases.items[0];
            const tracksUrl = `https://${API_HOST}/album_tracks/?id=${album.id}&offset=0&limit=10`;
            
            const tracksResponse = await fetch(tracksUrl, options);
            const tracksData = await tracksResponse.json();
            
            if (tracksData.data?.album?.tracks?.items) {
                // Añadimos información del álbum a cada track
                const tracksWithAlbumInfo = tracksData.data.album.tracks.items.map(item => ({
                    track: item.track,
                    albumCover: album.coverArt?.sources?.[0]?.url,
                    albumName: album.name
                }));
                allTracks = [...allTracks, ...tracksWithAlbumInfo];
            }
        }

        if (allTracks.length === 0) {
            container.innerHTML = `
                <div class="alert alert-hydro">
                    <i class="fas fa-music me-2"></i>
                    No se encontraron melodías en las partituras de este compositor.
                </div>
            `;
            return;
        }

        // Obtenemos los IDs de los tracks para los previews
        const trackIds = allTracks.map(item => item.track.uri.split(':')[2]).join(',');
        const previewsUrl = `https://${API_HOST}/tracks/?ids=${trackIds}`;
        const previewsResponse = await fetch(previewsUrl, options);
        const previewsData = await previewsResponse.json();

        const tracksWithPreviews = previewsData.tracks?.reduce((acc, track) => {
            acc[track.id] = {
                preview_url: track.preview_url,
                duration: track.duration_ms
            };
            return acc;
        }, {});

        // Mostramos las canciones con imágenes de álbum
        let html = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h3 class="text-fontaine"><i class="fas fa-star me-2"></i>Obras destacadas de ${artistName}</h3>
                <button onclick="showResults('artists')" class="btn btn-hydro-outline">
                    <i class="fas fa-arrow-left me-1"></i> Volver
                </button>
            </div>
            <div class="row row-cols-1 row-cols-md-3 g-4">
        `;

        // Mostramos hasta 10 canciones como máximo
        allTracks.slice(0, 10).forEach(item => {
            const track = item.track;
            const trackInfo = tracksWithPreviews[track.uri.split(':')[2]] || {};
            const previewUrl = trackInfo.preview_url;
            const duration = trackInfo.duration ? formatDuration(trackInfo.duration) : "0:00";
            const coverArtUrl = getOptimizedImageUrl(item.albumCover || track.album?.coverArt?.sources?.[0]?.url);
            const spotifyUrl = `https://open.spotify.com/track/${track.uri.split(':')[2]}`;
            const albumName = item.albumName || track.album?.name || "Álbum desconocido";

            html += `
                <div class="col">
                    <div class="card h-100 card-hydro">
                        <img src="${coverArtUrl}" class="card-img-top img-square" alt="Portada del álbum">
                        <div class="card-body">
                            <h5 class="card-title">${track.name || "Obra desconocida"}</h5>
                            <p class="card-text small text-hydro-light">
                                <span>${albumName}</span><br>
                                <span>${duration}</span>
                            </p>
                        </div>
                        <div class="card-footer bg-transparent border-top-hydro">
                            <div class="d-flex gap-2">
                                <a href="${spotifyUrl}" target="_blank" class="btn btn-sm btn-outline-hydro flex-grow-1">
                                    <i class="fas fa-external-link-alt me-1"></i> Abrir
                                </a>
                                <button onclick="playPreview('${previewUrl}', this)" 
                                        ${!previewUrl ? 'disabled' : ''} 
                                        class="btn btn-sm btn-hydro flex-grow-1">
                                    ${previewUrl ? '<i class="fas fa-play me-1"></i> Escuchar' : '<i class="fas fa-ban me-1"></i> No disponible'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        container.innerHTML = html + '</div>';
    } catch (error) {
        console.error("Error al obtener obras populares:", error);
        container.innerHTML = `
            <div class="alert alert-hydro">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error al cargar las obras populares: ${error.message}
                <button onclick="showResults('artists')" class="btn btn-hydro-outline mt-3">
                    <i class="fas fa-arrow-left me-1"></i> Volver
                </button>
            </div>
        `;
    }
}

// Melodías de partitura
async function getAlbumTracks(albumId, artistName, artistId) {
    const container = document.getElementById("resultsContainer");
    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-hydro" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-3">Organizando las melodías en la biblioteca de Fontaine...</p>
        </div>
    `;

    try {
        // URLs para obtener los datos del álbum y las canciones
        const metadataUrl = `https://${API_HOST}/albums/?ids=${albumId}`;
        const tracksUrl = `https://${API_HOST}/album_tracks/?id=${albumId}&offset=0&limit=50`;

        const options = {
            method: "GET",
            headers: {
                "x-rapidapi-key": API_KEY,
                "x-rapidapi-host": API_HOST
            }
        };

        // Hacer ambas peticiones en paralelo
        const [metadataResponse, tracksResponse] = await Promise.all([
            fetch(metadataUrl, options),
            fetch(tracksUrl, options)
        ]);

        const [metadata, tracksData] = await Promise.all([
            metadataResponse.json(),
            tracksResponse.json()
        ]);

        // Obtener la imagen del álbum
        const albumCover = metadata.albums?.[0]?.images?.[0]?.url || 
                           tracksData.data?.album?.coverArt?.sources?.[0]?.url;

        const albumData = tracksData.data?.album;
        const coverArtUrl = getOptimizedImageUrl(albumCover, 300);

        // Obtener los IDs de las pistas
        const trackIds = albumData?.tracks?.items
            .map(item => item.track.uri.split(':')[2])
            .filter(id => id)
            .join(',');

        // Obtener los previews de las pistas
        const previewsUrl = `https://${API_HOST}/tracks/?ids=${trackIds}`;
        const previewsResponse = await fetch(previewsUrl, options);
        const previewsData = await previewsResponse.json();

        const tracksWithPreviews = previewsData.tracks?.map(track => ({
            id: track.id,
            preview_url: track.preview_url
        })) || [];

        // Construcción del HTML
        let html = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h3 class="text-fontaine"><i class="fas fa-music me-2"></i>${albumData?.name || 'Partitura'} - ${artistName}</h3>
                <button onclick="getArtistAlbums('${artistId}', '${artistName}')" class="btn btn-hydro-outline">
                    <i class="fas fa-arrow-left me-1"></i> Volver
                </button>
            </div>
            <div class="row">
                <div class="col-md-3 text-center mb-4">
                    <img src="${coverArtUrl}" class="img-fluid rounded shadow" alt="Portada de partitura">
                    <h5 class="mt-3">${albumData?.name || 'Partitura'}</h5>
                    <p class="text-hydro-light">${artistName}</p>
                </div>
                <div class="col-md-9">
                    <div class="list-group list-group-hydro">
        `;

        albumData?.tracks?.items?.forEach((item, index) => {
            const track = item.track;
            const duration = formatDuration(track.duration?.totalMilliseconds);
            const preview = tracksWithPreviews.find(t => t.id === track.uri.split(':')[2]);
            const previewUrl = preview?.preview_url;

            html += `
                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-hydro me-2">${index + 1}</span>
                        <strong>${track.name || "Melodía desconocida"}</strong>
                        <small class="text-hydro-light ms-2">${duration}</small>
                    </div>
                    <button onclick="playPreview('${previewUrl}', this)" 
                            ${!previewUrl ? 'disabled' : ''} 
                            class="btn btn-sm btn-hydro">
                        ${previewUrl ? '<i class="fas fa-play"></i>' : '<i class="fas fa-ban"></i>'}
                    </button>
                </div>`;
        });

        container.innerHTML = html + '</div></div></div>';
    } catch (error) {
        console.error("Error al obtener melodías:", error);
        container.innerHTML = `
            <div class="alert alert-hydro">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error: ${error.message}
                <button onclick="getArtistAlbums('${artistId}', '${artistName}')" class="btn btn-hydro-outline mt-3">
                    <i class="fas fa-arrow-left me-1"></i> Volver
                </button>
            </div>
        `;
    }
}

// Función para mostrar "no hay resultados"
function showNoResults() {
    document.getElementById("resultsContainer").innerHTML = `
        <div class="alert alert-hydro">
            <i class="fas fa-search me-2"></i>
            No se encontraron resultados en los archivos de Fontaine.
        </div>
    `;
}

// Estilos dinámicos
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .img-square {
        width: 100%;
        height: 200px;
        object-fit: cover;
        aspect-ratio: 1/1;
    }
    
    .card-hydro {
        transition: all 0.3s ease;
        border: none;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(79, 193, 233, 0.1);
        background-color: rgba(10, 46, 56, 0.8);
        color: white;
    }
    
    .card-hydro:hover {
        transform: translateY(-5px);
        box-shadow: 0 5px 15px rgba(79, 193, 233, 0.3);
        background-color: rgba(10, 46, 56, 0.9);
    }
    
    .border-top-hydro {
        border-top: 1px solid rgba(79, 193, 233, 0.3) !important;
    }
    
    .btn-hydro {
        background-color: var(--hydro-blue) !important;
        border-color: var(--hydro-blue) !important;
        color: var(--hydro-dark) !important;
    }
    
    .btn-hydro:hover {
        background-color: var(--furina-purple) !important;
        border-color: var(--furina-purple) !important;
        color: white !important;
    }
    
    .btn-hydro-outline {
        background-color: transparent !important;
        border-color: var(--hydro-blue) !important;
        color: var(--hydro-blue) !important;
    }
    
    .btn-hydro-outline:hover {
        background-color: var(--hydro-blue) !important;
        color: var(--hydro-dark) !important;
    }
    
    .btn-outline-hydro {
        background-color: transparent !important;
        border-color: var(--hydro-blue) !important;
        color: var(--hydro-blue) !important;
    }
    
    .btn-outline-hydro:hover {
        background-color: var(--hydro-blue) !important;
        color: var(--hydro-dark) !important;
    }
    
    .alert-hydro {
        background-color: rgba(10, 46, 56, 0.9) !important;
        border: 1px solid var(--hydro-blue) !important;
        color: white !important;
    }
    
    .text-hydro {
        color: var(--hydro-blue) !important;
    }
    
    .text-hydro-light {
        color: var(--hydro-light) !important;
    }
    
    .text-fontaine {
        color: var(--fontaine-gold) !important;
    }
    
    .list-group-hydro .list-group-item {
        background-color: rgba(10, 46, 56, 0.7);
        color: white;
        border-color: rgba(79, 193, 233, 0.3);
    }
    
    .list-group-hydro .list-group-item:hover {
        background-color: rgba(79, 193, 233, 0.2);
    }
    
    .bg-hydro {
        background-color: var(--hydro-blue) !important;
    }
    
    .spinner-border.text-hydro {
        color: var(--hydro-blue) !important;
    }
`;
document.head.appendChild(style);