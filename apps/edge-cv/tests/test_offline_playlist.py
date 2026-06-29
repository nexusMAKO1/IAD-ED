"""
test_offline_playlist.py — Unit Tests for Offline Media Playlist Manager
IAD & SmartQueue AI — Express Display SmartVision (T-011)
"""

import shutil
import time
from datetime import datetime, timedelta

import cv2
import numpy as np
import pytest

from app.media.offline_playlist import (
    MediaItem,
    OfflinePlaylistManager,
    Playlist,
    PlaylistManagerError,
    DownloadError,
)


@pytest.fixture
def temp_media_dir(tmp_path):
    """Create a temporary directory for media base storage."""
    base_dir = tmp_path / "media_data"
    base_dir.mkdir()
    return base_dir


@pytest.fixture
def manager(temp_media_dir):
    """Initialize OfflinePlaylistManager using temp directory."""
    return OfflinePlaylistManager(base_dir=temp_media_dir)


@pytest.fixture
def dummy_image(temp_media_dir):
    """Create a real valid JPEG image for validation tests."""
    img_path = temp_media_dir / "test_image.jpg"
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.imwrite(str(img_path), img)
    return img_path


@pytest.fixture
def dummy_video(temp_media_dir):
    """Create a simple valid MP4 video file for validation tests."""
    video_path = temp_media_dir / "test_video.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(video_path), fourcc, 10.0, (100, 100))
    for _ in range(10):
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        out.write(frame)
    out.release()
    return video_path


# ---------------------------------------------------------------------------
# Test Cases: Pydantic Validation & Models
# ---------------------------------------------------------------------------

def test_media_item_model():
    """Test MediaItem validation constraints."""
    # Valid model
    item = MediaItem(filename="promo.mp4", duration=15, type="video")
    assert item.filename == "promo.mp4"
    assert item.duration == 15
    assert item.type == "video"

    # Invalid extension
    with pytest.raises(ValueError):
        MediaItem(filename="promo.txt", duration=15, type="video")

    # Invalid duration
    with pytest.raises(ValueError):
        MediaItem(filename="promo.mp4", duration=-5, type="video")

    # Invalid type
    with pytest.raises(ValueError):
        MediaItem(filename="promo.mp4", duration=15, type="audio")


def test_playlist_model():
    """Test Playlist model and validation rules."""
    start = datetime.now()
    end = start + timedelta(days=1)
    
    # Valid playlist
    playlist = Playlist(
        id="playlist_1",
        name="Winter Promo",
        campaign_id="camp_9",
        priority=5,
        start_date=start,
        end_date=end,
        media=[MediaItem(filename="ad.jpg", duration=10, type="image")],
    )
    assert playlist.id == "playlist_1"
    assert playlist.media[0].filename == "ad.jpg"

    # End date before start date
    with pytest.raises(ValueError):
        Playlist(
            id="playlist_invalid",
            name="Error Campaign",
            campaign_id="camp_err",
            start_date=end,
            end_date=start,
        )


# ---------------------------------------------------------------------------
# Test Cases: Playlist CRUD
# ---------------------------------------------------------------------------

def test_playlist_crud(manager):
    """Test create, read, update, delete for Playlists."""
    start = datetime.now()
    end = start + timedelta(hours=2)
    playlist = Playlist(
        id="playlist_test",
        name="Test Campaign",
        campaign_id="camp_test",
        priority=10,
        start_date=start,
        end_date=end,
        media=[MediaItem(filename="ad.png", duration=5, type="image")],
    )

    # 1. Create
    manager.create_playlist(playlist)
    assert manager.get_playlist_path("playlist_test").exists()

    # Create duplicate ID raises error
    with pytest.raises(PlaylistManagerError):
        manager.create_playlist(playlist)

    # 2. Get
    loaded = manager.get_playlist("playlist_test")
    assert loaded is not None
    assert loaded.name == "Test Campaign"
    assert len(loaded.media) == 1

    # Get non-existent playlist
    assert manager.get_playlist("does_not_exist") is None

    # 3. Update
    loaded.name = "Updated Test Campaign"
    manager.update_playlist(loaded)
    assert manager.get_playlist("playlist_test").name == "Updated Test Campaign"

    # Update non-existent playlist raises error
    playlist_not_exists = Playlist(
        id="missing_id",
        name="Missing",
        campaign_id="missing",
        start_date=start,
        end_date=end,
    )
    with pytest.raises(PlaylistManagerError):
        manager.update_playlist(playlist_not_exists)

    # 4. List Playlists
    playlists = manager.list_playlists()
    assert len(playlists) == 1
    assert playlists[0].id == "playlist_test"

    # 5. Delete
    manager.delete_playlist("playlist_test")
    assert not manager.get_playlist_path("playlist_test").exists()

    # Delete non-existent raises error
    with pytest.raises(PlaylistManagerError):
        manager.delete_playlist("playlist_test")


# ---------------------------------------------------------------------------
# Test Cases: Media Validation
# ---------------------------------------------------------------------------

def test_media_validation(manager, dummy_image, dummy_video):
    """Test media file format and integrity validation checks."""
    assert manager.validate_media(dummy_image) is True
    assert manager.validate_media(dummy_video) is True

    # Empty file validation
    empty_file = manager.base_dir / "empty.jpg"
    empty_file.touch()
    assert manager.validate_media(empty_file) is False

    # Unsupported format
    txt_file = manager.base_dir / "note.txt"
    txt_file.write_text("hello")
    assert manager.validate_media(txt_file) is False

    # Non-existent file
    assert manager.validate_media(manager.base_dir / "missing.jpg") is False


# ---------------------------------------------------------------------------
# Test Cases: Online/Offline Mode and Downloads
# ---------------------------------------------------------------------------

def test_online_offline_modes(manager):
    """Test tracking online/offline states."""
    assert manager.online_mode is True
    
    manager.set_offline()
    assert manager.online_mode is False

    manager.set_online()
    assert manager.online_mode is True


def test_download_media_existing_valid(manager, dummy_image):
    """Test that download skips fetching if valid file is already present."""
    # Place dummy image in final destination
    dest = manager.images_dir / "logo.jpg"
    shutil.copy(str(dummy_image), str(dest))

    # Trigger download (url can be dummy since it should skip download)
    local_path = manager.download_media("http://invalid-url.com/logo.jpg", "logo.jpg")
    assert local_path == str(dest)


def test_download_media_retries_and_failure(manager):
    """Test download failure when URL is unreachable."""
    with pytest.raises(DownloadError):
        # Trigger download with non-existent URL
        manager.download_media("http://127.0.0.1:9999/does-not-exist.mp4", "ad.mp4", retries=2, backoff_factor=0.01)


# ---------------------------------------------------------------------------
# Test Cases: Scheduling, Playback, Round-Robin
# ---------------------------------------------------------------------------

def test_campaign_activation(manager, dummy_image):
    """Test campaign active state logic based on timestamps."""
    start = datetime.now() - timedelta(minutes=30)
    end = datetime.now() + timedelta(minutes=30)

    # 1. Active campaign
    p_active = Playlist(
        id="p_active",
        name="Active",
        campaign_id="c1",
        priority=1,
        active=True,
        start_date=start,
        end_date=end,
    )
    assert manager.is_campaign_active(p_active) is True

    # 2. Inactive flag
    p_inactive = p_active.model_copy()
    p_inactive.id = "p_inactive"
    p_inactive.active = False
    assert manager.is_campaign_active(p_inactive) is False

    # 3. Not yet started
    p_future = p_active.model_copy()
    p_future.id = "p_future"
    p_future.start_date = datetime.now() + timedelta(hours=1)
    p_future.end_date = datetime.now() + timedelta(hours=2)
    assert manager.is_campaign_active(p_future) is False

    # 4. Expired
    p_past = p_active.model_copy()
    p_past.id = "p_past"
    p_past.start_date = datetime.now() - timedelta(hours=2)
    p_past.end_date = datetime.now() - timedelta(hours=1)
    assert manager.is_campaign_active(p_past) is False


def test_get_active_playlist_priority(manager):
    """Test retrieving active playlist based on highest priority selection."""
    start = datetime.now() - timedelta(minutes=10)
    end = datetime.now() + timedelta(minutes=10)

    p1 = Playlist(id="p1", name="Low Priority", campaign_id="c1", priority=1, start_date=start, end_date=end)
    p2 = Playlist(id="p2", name="High Priority", campaign_id="c2", priority=10, start_date=start, end_date=end)

    manager.create_playlist(p1)
    manager.create_playlist(p2)

    active = manager.get_active_playlist()
    assert active is not None
    assert active.id == "p2"


def test_get_next_media_round_robin(manager, dummy_image, dummy_video):
    """Test sequence traversal and round-robin scheduling."""
    start = datetime.now() - timedelta(minutes=10)
    end = datetime.now() + timedelta(minutes=10)

    # Put media files in destination folders
    shutil.copy(str(dummy_image), str(manager.images_dir / "img1.jpg"))
    shutil.copy(str(dummy_video), str(manager.videos_dir / "vid1.mp4"))

    playlist = Playlist(
        id="play_seq",
        name="Sequential",
        campaign_id="c_seq",
        priority=100,
        start_date=start,
        end_date=end,
        media=[
            MediaItem(filename="img1.jpg", duration=5, type="image"),
            MediaItem(filename="vid1.mp4", duration=15, type="video"),
        ],
    )
    manager.create_playlist(playlist)

    # Playback 1
    m1 = manager.get_next_media()
    assert m1 is not None
    assert m1.filename == "img1.jpg"

    # Playback 2
    m2 = manager.get_next_media()
    assert m2 is not None
    assert m2.filename == "vid1.mp4"

    # Playback 3 (Wrap around)
    m3 = manager.get_next_media()
    assert m3 is not None
    assert m3.filename == "img1.jpg"


# ---------------------------------------------------------------------------
# Test Cases: Cache Management & Eviction
# ---------------------------------------------------------------------------

def test_cache_maintenance_lru(manager, dummy_image, dummy_video):
    """Test LRU eviction strategy when cache limit is exceeded."""
    # Set cache max size small (e.g. 1500 bytes)
    manager.max_cache_size = 1500

    # Create dummy images that take space
    img1 = np.zeros((200, 200, 3), dtype=np.uint8)  # ~120KB uncompressed but we'll save it
    cv2.imwrite(str(manager.images_dir / "cache1.jpg"), img1)
    # Track file
    (manager.cache_dir / "cache1.jpg.access").touch()

    # Sleep briefly to separate access times
    time.sleep(0.1)

    cv2.imwrite(str(manager.images_dir / "cache2.jpg"), img1)
    (manager.cache_dir / "cache2.jpg.access").touch()

    # Run maintenance manually
    manager._maintain_cache()

    # cache1.jpg should be deleted as it is the oldest, keeping cache2.jpg
    assert not (manager.images_dir / "cache1.jpg").exists()
    assert (manager.images_dir / "cache2.jpg").exists()


def test_remove_obsolete_media(manager, dummy_image):
    """Test deleting obsolete media files unreferenced by playlists."""
    # Copy file to images directory
    ref_file = manager.images_dir / "ref.jpg"
    obsolete_file = manager.images_dir / "obsolete.jpg"
    shutil.copy(str(dummy_image), str(ref_file))
    shutil.copy(str(dummy_image), str(obsolete_file))

    start = datetime.now()
    end = start + timedelta(hours=1)
    playlist = Playlist(
        id="playlist_obsolete_test",
        name="Obsolete Test",
        campaign_id="camp_obs",
        start_date=start,
        end_date=end,
        media=[MediaItem(filename="ref.jpg", duration=5, type="image")],
    )
    manager.create_playlist(playlist)

    # Perform cleanup
    manager.remove_obsolete_media()

    # ref.jpg should be kept, obsolete.jpg deleted
    assert ref_file.exists()
    assert not obsolete_file.exists()


# ---------------------------------------------------------------------------
# Test Cases: Synchronization
# ---------------------------------------------------------------------------

def test_synchronize_active_flow(manager, dummy_image):
    """Test playlist database sync and deletion of obsolete local records."""
    # 1. Create a local playlist that is not in the remote list
    local_p = Playlist(
        id="local_only",
        name="Local",
        campaign_id="c_local",
        start_date=datetime.now(),
        end_date=datetime.now() + timedelta(hours=1),
    )
    manager.create_playlist(local_p)

    # 2. Remote list contains a different playlist
    remote_p = Playlist(
        id="remote_only",
        name="Remote",
        campaign_id="c_remote",
        start_date=datetime.now(),
        end_date=datetime.now() + timedelta(hours=1),
        media=[MediaItem(filename="downloaded.jpg", duration=5, type="image")],
    )

    # Pre-populate image to destination to mock download skipping
    dest = manager.images_dir / "downloaded.jpg"
    shutil.copy(str(dummy_image), str(dest))

    # Synchronize
    manager.synchronize(
        remote_playlists=[remote_p],
        remote_media_urls={"downloaded.jpg": "http://mock-url.com/downloaded.jpg"},
    )

    # Check local_only was deleted, remote_only created, and downloaded.jpg is preserved
    assert manager.get_playlist("local_only") is None
    assert manager.get_playlist("remote_only") is not None
    assert dest.exists()
