# Dockerfile
FROM python:3.11

# 1) Switch to “root” folder,  /code
WORKDIR /code

# 2) Copy only requirements.txt first, so Docker can cache pip-install
COPY requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir -r /code/requirements.txt

# 3) copy the entire project into /code/
COPY . /code/

# 4) Expose the port
EXPOSE 8000

# 5) Run Uvicorn pointing at the “app” package:
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
