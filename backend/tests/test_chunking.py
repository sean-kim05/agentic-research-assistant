"""Unit tests for the character-window chunker (pure function, no I/O)."""

import pytest

from chunking import chunk_text


def test_empty_or_whitespace_returns_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   \n\t ") == []


def test_short_text_is_one_chunk():
    assert chunk_text("hello world", 1000, 200) == ["hello world"]


def test_windows_and_overlap():
    text = "abcdefghij" * 200  # 2000 chars, no whitespace
    chunks = chunk_text(text, chunk_size=1000, overlap=200)
    # step = 800 -> windows start at 0, 800, 1600 => 3 chunks
    assert len(chunks) == 3
    assert len(chunks[0]) == 1000
    # the last `overlap` chars of a chunk equal the first `overlap` of the next
    assert chunks[0][-200:] == chunks[1][:200]


def test_invalid_arguments_raise():
    with pytest.raises(ValueError):
        chunk_text("x", chunk_size=0)
    with pytest.raises(ValueError):
        chunk_text("x", chunk_size=100, overlap=-1)
    with pytest.raises(ValueError):
        chunk_text("x", chunk_size=100, overlap=100)  # overlap >= chunk_size
