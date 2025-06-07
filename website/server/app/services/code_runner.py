import base64, subprocess, tempfile, textwrap, pathlib, uuid

def run_python(code: str) -> str:
    """
    Runs `code` inside an isolated temp folder.
    Returns the resulting PNG as a base64 string.
    """
    clean = textwrap.dedent(code)
    run_id = uuid.uuid4().hex[:8]

    with tempfile.TemporaryDirectory(prefix=f"viz-{run_id}-") as tmp:
        tmp_path = pathlib.Path(tmp)
        src = tmp_path / "viz.py"
        png = tmp_path / "out.png"

        # Force headless backend for matplotlib
        src.write_text("import matplotlib; matplotlib.use('Agg')\n" + clean)

        # Execute with a 30-second timeout
        try:
            subprocess.run(
                ["python", str(src)],
                cwd=tmp,
                check=True,
                timeout=30,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Code error: {e.stderr}") from e
        except subprocess.TimeoutExpired:
            raise RuntimeError("Code execution timed out")

        if not png.exists():
            raise RuntimeError("LLM code did not create 'out.png'")

        return base64.b64encode(png.read_bytes()).decode()