/** Open the system file picker for images. */
export function openFilePicker(onFiles: (files: File[]) => void, multiple = false, accept = 'image/*,.heic,.heif') {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;
  input.style.display = 'none';
  input.onchange = () => {
    const files = [...(input.files ?? [])];
    input.remove();
    if (files.length) onFiles(files);
  };
  document.body.appendChild(input);
  input.click();
}
