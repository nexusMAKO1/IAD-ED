"""
offline_playlist.py — Offline Media Playlist Manager
IAD & SmartQueue AI — Express Display SmartVision (T-011)

Manages playlists and campaign media assets for edge signage devices. Handles local
caching, downloads with retry mechanisms, media type validation, calendar-based
scheduling, cache cleanup using LRU strategy, and online/offline status syncing.
"""

from __future__ import annotations

import logging
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import cv2
import httpx
from pydantic import BaseModel, Field, field_validator

# Set up logging
log = logging.getLogger("iad.media.playlist")

# Supported media extensions
SUPPORTED_EXTENSIONS = {".mp4", ".webm", ".jpg", ".jpeg", ".png"}


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class PlaylistManagerError(Exception):
    """Base exception for all playlist manager errors."""

    pass


class InvalidPlaylistError(PlaylistManagerError):
    """Raised when a playlist fails Pydantic validation or logic checks."""

    pass


class InvalidMediaError(PlaylistManagerError):
    """Raised when a media file has an unsupported format or is corrupted."""

    pass


class DownloadError(PlaylistManagerError):
    """Raised when downloading a media asset fails after retries."""

    pass


class StorageError(PlaylistManagerError):
    """Raised when there is insufficient disk space to save media."""

    pass


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------


class MediaItem(BaseModel):
    """Represents a single media asset inside a playlist."""

    filename: str
    duration: int = Field(gt=0, description="Duration in seconds")
    type: str = Field(pattern="^(video|image)$", description="Type of media asset")

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v: str) -> str:
        ext = Path(v).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported media extension '{ext}'. Supported: {SUPPORTED_EXTENSIONS}"
            )
        return v


class Playlist(BaseModel):
    """Represents a signage playlist model containing campaign scheduling & media."""

    id: str
    name: str
    campaign_id: str
    priority: int = Field(default=0)
    active: bool = Field(default=True)
    start_date: datetime
    end_date: datetime
    media: List[MediaItem] = Field(default_factory=list)

    @field_validator("end_date")
    @classmethod
    def validate_dates(cls, v: datetime, info: Any) -> datetime:
        # Pydantic v2 validation context
        start_date = info.data.get("start_date")
        if start_date and v < start_date:
            raise ValueError("end_date must be after start_date")
        return v


# ---------------------------------------------------------------------------
# Offline Playlist Manager
# ---------------------------------------------------------------------------


class OfflinePlaylistManager:
    """
    Manages offline campaigns and signage media assets.

    Features include local file validation, downloads from URLs with retries,
    calendar scheduling, LRU caching, and seamless online/offline state switching.
    """

    def __init__(
        self,
        base_dir: str | Path = "data/media",
        max_cache_size_bytes: int = 500 * 1024 * 1024,  # 500 MB
        min_free_space_bytes: int = 100 * 1024 * 1024,  # 100 MB
        connection_timeout_seconds: float = 10.0,
    ) -> None:
        """
        Initialize the Playlist Manager.

        Parameters
        ----------
        base_dir : str or Path
            Root path where playlists and media folders reside.
        max_cache_size_bytes : int
            Max size of the cache directory before LRU eviction triggers.
        min_free_space_bytes : int
            Minimum free storage space required to allow new downloads.
        connection_timeout_seconds : float
            Request timeout for media downloading.
        """
        self.base_dir = Path(base_dir)
        self.max_cache_size = max_cache_size_bytes
        self.min_free_space = min_free_space_bytes
        self.timeout = connection_timeout_seconds

        # Defined subdirectories
        self.videos_dir = self.base_dir / "videos"
        self.images_dir = self.base_dir / "images"
        self.playlists_dir = self.base_dir / "playlists"
        self.cache_dir = self.base_dir / "cache"

        # State trackers
        self.online_mode: bool = True
        self.current_playback_index: Dict[
            str, int
        ] = {}  # Tracks next item index per playlist

        self.initialize()

    def initialize(self) -> None:
        """Create necessary directories if they do not exist."""
        try:
            self.videos_dir.mkdir(parents=True, exist_ok=True)
            self.images_dir.mkdir(parents=True, exist_ok=True)
            self.playlists_dir.mkdir(parents=True, exist_ok=True)
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            log.info("Initialized directory structure under: %s", self.base_dir)
        except Exception as exc:
            raise StorageError(
                f"Failed to initialize directory structure: {exc}"
            ) from exc

    # ------------------------------------------------------------------ #
    # Connection States
    # ------------------------------------------------------------------ #

    def set_online(self) -> None:
        """Restore online mode and trigger synchronization."""
        if not self.online_mode:
            self.online_mode = True
            log.info("Internet connectivity restored. Online mode activated.")

    def set_offline(self) -> None:
        """Switch to offline mode."""
        if self.online_mode:
            self.online_mode = False
            log.warning("Internet connection lost. Switching to offline mode.")

    # ------------------------------------------------------------------ #
    # Playlist CRUD
    # ------------------------------------------------------------------ #

    def get_playlist_path(self, playlist_id: str) -> Path:
        """Get the local JSON filepath for a playlist."""
        return self.playlists_dir / f"{playlist_id}.json"

    def create_playlist(self, playlist: Playlist) -> Playlist:
        """
        Save a new playlist to storage.

        Parameters
        ----------
        playlist : Playlist
            The Playlist Pydantic object.
        """
        path = self.get_playlist_path(playlist.id)
        if path.exists():
            raise PlaylistManagerError(
                f"Playlist with ID '{playlist.id}' already exists."
            )

        try:
            path.write_text(playlist.model_dump_json(indent=4), encoding="utf-8")
            log.info("Created playlist: %s (%s)", playlist.name, playlist.id)
            return playlist
        except Exception as exc:
            raise StorageError(f"Failed to write playlist file: {exc}") from exc

    def get_playlist(self, playlist_id: str) -> Playlist | None:
        """
        Retrieve a playlist from file.

        Parameters
        ----------
        playlist_id : str
            ID of the playlist to get.
        """
        path = self.get_playlist_path(playlist_id)
        if not path.exists():
            return None

        try:
            content = path.read_text(encoding="utf-8")
            return Playlist.model_validate_json(content)
        except Exception as exc:
            raise InvalidPlaylistError(
                f"Corrupted or invalid playlist file '{playlist_id}': {exc}"
            ) from exc

    def update_playlist(self, playlist: Playlist) -> Playlist:
        """
        Update an existing playlist.

        Parameters
        ----------
        playlist : Playlist
            The updated Playlist object.
        """
        path = self.get_playlist_path(playlist.id)
        if not path.exists():
            raise PlaylistManagerError(
                f"Playlist with ID '{playlist.id}' does not exist."
            )

        try:
            path.write_text(playlist.model_dump_json(indent=4), encoding="utf-8")
            log.info("Updated playlist: %s (%s)", playlist.name, playlist.id)
            return playlist
        except Exception as exc:
            raise StorageError(f"Failed to update playlist file: {exc}") from exc

    def delete_playlist(self, playlist_id: str) -> None:
        """Delete a playlist from storage."""
        path = self.get_playlist_path(playlist_id)
        if not path.exists():
            raise PlaylistManagerError(
                f"Playlist with ID '{playlist_id}' does not exist."
            )

        try:
            path.unlink()
            if playlist_id in self.current_playback_index:
                del self.current_playback_index[playlist_id]
            log.info("Deleted playlist: %s", playlist_id)
        except Exception as exc:
            raise StorageError(f"Failed to delete playlist file: {exc}") from exc

    def list_playlists(self) -> List[Playlist]:
        """List all stored playlists."""
        playlists = []
        for file in self.playlists_dir.glob("*.json"):
            playlist = self.get_playlist(file.stem)
            if playlist:
                playlists.append(playlist)
        return playlists

    # ------------------------------------------------------------------ #
    # Activation / Deactivation
    # ------------------------------------------------------------------ #

    def activate_playlist(self, playlist_id: str) -> None:
        """Activate a playlist."""
        playlist = self.get_playlist(playlist_id)
        if not playlist:
            raise PlaylistManagerError(f"Playlist '{playlist_id}' not found.")
        playlist.active = True
        self.update_playlist(playlist)

    def deactivate_playlist(self, playlist_id: str) -> None:
        """Deactivate a playlist."""
        playlist = self.get_playlist(playlist_id)
        if not playlist:
            raise PlaylistManagerError(f"Playlist '{playlist_id}' not found.")
        playlist.active = False
        self.update_playlist(playlist)

    # ------------------------------------------------------------------ #
    # Scheduling & Playback Logic
    # ------------------------------------------------------------------ #

    def is_campaign_active(self, playlist: Playlist) -> bool:
        """Check if campaign is active and scheduled for current system time."""
        if not playlist.active:
            return False
        now = datetime.now()
        return playlist.start_date <= now <= playlist.end_date

    def get_active_playlist(self) -> Playlist | None:
        """
        Get the active playlist with the highest priority.
        If multiple playlists have the same highest priority, return the newest created.
        """
        playlists = self.list_playlists()
        active_playlists = [p for p in playlists if self.is_campaign_active(p)]

        if not active_playlists:
            return None

        # Sort by priority descending
        active_playlists.sort(key=lambda p: p.priority, reverse=True)
        return active_playlists[0]

    def get_next_media(self) -> MediaItem | None:
        """
        Return the next scheduled MediaItem in the current active playlist.
        Uses a round-robin playback selector per playlist.
        """
        playlist = self.get_active_playlist()
        if not playlist or not playlist.media:
            return None

        p_id = playlist.id
        idx = self.current_playback_index.get(p_id, 0)

        # Handle index wrap around
        if idx >= len(playlist.media):
            idx = 0

        media_item = playlist.media[idx]

        # Verify media file exists locally
        local_path = self.get_media_dest_path(media_item.filename)
        if not local_path.exists():
            log.warning(
                "Media file '%s' is missing locally. Playback degraded.",
                media_item.filename,
            )
            # Find first available fallback media
            for i, item in enumerate(playlist.media):
                if self.get_media_dest_path(item.filename).exists():
                    self.current_playback_index[p_id] = i + 1
                    return item
            return None

        self.current_playback_index[p_id] = idx + 1
        return media_item

    # ------------------------------------------------------------------ #
    # Media Validation & Location
    # ------------------------------------------------------------------ #

    def get_media_dest_path(self, filename: str) -> Path:
        """Determine destination path based on media extension/type."""
        ext = Path(filename).suffix.lower()
        if ext in {".mp4", ".webm"}:
            return self.videos_dir / filename
        elif ext in {".jpg", ".jpeg", ".png"}:
            return self.images_dir / filename
        raise InvalidMediaError(f"Unsupported media format '{ext}' for file {filename}")

    def validate_media(self, filepath: str | Path) -> bool:
        """
        Validate media file integrity and correctness of format.

        Parameters
        ----------
        filepath : Path
            Path to file to validate.
        """
        path = Path(filepath)
        if not path.exists():
            return False

        ext = path.suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            return False

        # Check for empty file
        if path.stat().st_size == 0:
            return False

        # Basic header checks for validation
        try:
            if ext in {".jpg", ".jpeg", ".png"}:
                img = cv2.imread(str(path))
                if img is None:
                    return False
            elif ext == ".mp4":
                cap = cv2.VideoCapture(str(path))
                opened = cap.isOpened()
                cap.release()
                if not opened:
                    return False
        except Exception:
            return False

        return True

    # ------------------------------------------------------------------ #
    # Download Management
    # ------------------------------------------------------------------ #

    def download_media(
        self,
        url: str,
        filename: str,
        retries: int = 3,
        backoff_factor: float = 1.0,
    ) -> str:
        """
        Download a media asset from a URL.

        Parameters
        ----------
        url : str
            Remote URL of the asset.
        filename : str
            Local filename to save the asset.
        retries : int
            Number of download retry attempts.
        backoff_factor : float
            Multiplier for sleep duration between retries.
        """
        dest_path = self.get_media_dest_path(filename)

        # Check storage space first
        total, used, free = shutil.disk_usage(self.base_dir)
        if free < self.min_free_space:
            raise StorageError(
                f"Insufficient disk space. Free space is {free} bytes, "
                f"required minimum is {self.min_free_space} bytes."
            )

        # Skip download if a valid file already exists locally
        if dest_path.exists() and self.validate_media(dest_path):
            log.info("Media file already exists and is valid: %s", filename)
            # Update cache access times
            cache_track_path = self.cache_dir / f"{filename}.access"
            cache_track_path.touch(exist_ok=True)
            return str(dest_path)

        # Download to a temp file in the cache directory first
        temp_path = self.cache_dir / f"{filename}.tmp"

        log.info("Downloading media from %s", url)

        # Sync HTTP Client with retries
        for attempt in range(1, retries + 1):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    with client.stream("GET", url) as response:
                        if response.status_code != 200:
                            raise DownloadError(
                                f"HTTP error response code {response.status_code}"
                            )

                        # Write stream to temp file
                        with open(temp_path, "wb") as f:
                            for chunk in response.iter_bytes(chunk_size=8192):
                                f.write(chunk)

                # Validate the downloaded file integrity
                if not self.validate_media(temp_path):
                    raise InvalidMediaError("Downloaded file is invalid or corrupted.")

                # Move to final destination
                shutil.move(str(temp_path), str(dest_path))

                # Track cache access
                cache_track_path = self.cache_dir / f"{filename}.access"
                cache_track_path.touch(exist_ok=True)

                log.info("Successfully downloaded media: %s", filename)

                # Check cache size and run eviction if necessary
                self._maintain_cache()

                return str(dest_path)

            except Exception as exc:
                log.warning("Attempt %d failed to download %s: %s", attempt, url, exc)
                if temp_path.exists():
                    temp_path.unlink()

                if attempt == retries:
                    raise DownloadError(
                        f"Failed to download media after {retries} attempts: {exc}"
                    ) from exc

                # Backoff sleep
                time.sleep(backoff_factor * attempt)

        return ""

    # ------------------------------------------------------------------ #
    # Cache Management (LRU Eviction Strategy)
    # ------------------------------------------------------------------ #

    def _maintain_cache(self) -> None:
        """Evicts cache entries using LRU strategy if max size exceeded."""
        # Calculate total size of media stored
        media_files: List[
            Tuple[Path, float, int]
        ] = []  # List of (filepath, access_time, size)

        # Aggregate videos and images
        for directory in (self.videos_dir, self.images_dir):
            for file in directory.glob("*"):
                if file.is_file() and file.suffix.lower() in SUPPORTED_EXTENSIONS:
                    # Retrieve access track file
                    access_track = self.cache_dir / f"{file.name}.access"
                    access_time = (
                        access_track.stat().st_mtime
                        if access_track.exists()
                        else file.stat().st_mtime
                    )
                    size = file.stat().st_size
                    media_files.append((file, access_time, size))

        total_size = sum(f[2] for f in media_files)
        if total_size <= self.max_cache_size:
            return

        log.info(
            "Cache limit exceeded (%d bytes). Triggering LRU cleanup...", total_size
        )

        # Sort by access time ascending (oldest first)
        media_files.sort(key=lambda f: f[1])

        # Delete oldest files until we are under the cache budget
        for file, _, size in media_files:
            # Do not delete files belonging to active playlists
            if self._is_file_in_active_playlists(file.name):
                continue

            try:
                file.unlink()
                # Remove access tracking file
                access_track = self.cache_dir / f"{file.name}.access"
                if access_track.exists():
                    access_track.unlink()

                total_size -= size
                log.info("LRU Eviction: Deleted cached media '%s'", file.name)

                if total_size <= self.max_cache_size:
                    break
            except Exception as exc:
                log.error("Failed to evict media file '%s': %s", file.name, exc)

    def _is_file_in_active_playlists(self, filename: str) -> bool:
        """Helper to check if a filename is referenced in any active playlist."""
        playlists = self.list_playlists()
        for p in playlists:
            if self.is_campaign_active(p):
                for m in p.media:
                    if m.filename == filename:
                        return True
        return False

    def remove_obsolete_media(self) -> None:
        """Scan local files and delete any media not referenced in any stored playlists."""
        referenced_files = set()
        playlists = self.list_playlists()
        for p in playlists:
            for m in p.media:
                referenced_files.add(m.filename)

        log.info("Scanning for obsolete media files...")

        # Delete unreferenced videos and images
        for directory in (self.videos_dir, self.images_dir):
            for file in directory.glob("*"):
                if file.is_file() and file.name not in referenced_files:
                    try:
                        file.unlink()
                        # Also delete access track file
                        access_track = self.cache_dir / f"{file.name}.access"
                        if access_track.exists():
                            access_track.unlink()
                        log.info("Cleaned obsolete media file: %s", file.name)
                    except Exception as exc:
                        log.error(
                            "Failed to delete obsolete file '%s': %s", file.name, exc
                        )

    # ------------------------------------------------------------------ #
    # Synchronization Interface
    # ------------------------------------------------------------------ #

    def synchronize(
        self,
        remote_playlists: List[Playlist],
        remote_media_urls: Dict[str, str],
    ) -> None:
        """
        Synchronize local playlist database with a remote state.

        Parameters
        ----------
        remote_playlists : List[Playlist]
            The list of target playlists.
        remote_media_urls : Dict[str, str]
            Map of media filename -> URL for download.
        """
        log.info("Starting synchronization process...")
        if not self.online_mode:
            log.warning("Offline mode active. Synchronization skipped.")
            return

        remote_ids = {p.id for p in remote_playlists}
        local_playlists = self.list_playlists()

        # 1. Delete local playlists not present in the remote state
        for lp in local_playlists:
            if lp.id not in remote_ids:
                try:
                    self.delete_playlist(lp.id)
                except Exception as exc:
                    log.error("Sync: Failed to delete playlist '%s': %s", lp.id, exc)

        # 2. Save or update remote playlists locally
        for rp in remote_playlists:
            try:
                local_path = self.get_playlist_path(rp.id)
                if local_path.exists():
                    self.update_playlist(rp)
                else:
                    self.create_playlist(rp)
            except Exception as exc:
                log.error("Sync: Failed to save playlist '%s': %s", rp.id, exc)

        # 3. Download all media assets referenced in the synchronized playlists
        for rp in remote_playlists:
            for media_item in rp.media:
                filename = media_item.filename
                url = remote_media_urls.get(filename)
                if url:
                    try:
                        self.download_media(url, filename)
                    except Exception as exc:
                        log.error(
                            "Sync: Failed to download media '%s': %s", filename, exc
                        )
                else:
                    log.warning("Sync: Missing URL for media asset '%s'", filename)

        # 4. Cleanup obsolete media files
        self.remove_obsolete_media()
        log.info("Synchronization completed.")
