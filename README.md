# ReadAlong Alignment Editor

This is a quite simple little web application that will allow the
alignments in a ReadAlong (either a standalone HTML file, or an XML
file + associated audio, or some combination of the above) to be
edited.

## Usage

If you have a standalone HTML file such as you may download from
ReadAlong Studio, load it with the "Upload a ReadAlong file" button.
Otherwise, you must load both an audio file and a `.readalong` file.

The "Download" button will download the updated ReadAlong file (either
HTML or `.readalong` format).

## Limitations

It will try to give you back the same kind of file you uploaded, but
this is not guaranteed to be exactly the same, since it gets parsed
and serialized along the way.

## License

- src/segments/\*: BSD 3-clause
- everything else: MIT

## Author

David Huggins-Daines <dhd@ecolingui.ca>
