import streamlit as st
import os
import sys
import tempfile
import json
from pdf2image import convert_from_path
from PIL import Image

# Add current directory to path to allow imports from local modules
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

try:
    from main import analyze_document
except ImportError as e:
    st.error(f"Error importing modules: {e}")
    st.stop()

st.set_page_config(page_title="Renters Analyzer", layout="wide")

st.title("📄 Document Analysis Dashboard")
st.markdown("Upload a document (PDF or Image) to classify it and extract relevant data.")

uploaded_file = st.file_uploader("Choose a file", type=['pdf', 'png', 'jpg', 'jpeg'])

if uploaded_file:
    # Save uploaded file to a temporary file
    suffix = os.path.splitext(uploaded_file.name)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        tmp_file.write(uploaded_file.getvalue())
        tmp_path = tmp_file.name

    col1, col2 = st.columns([1, 1])

    with col1:
        st.subheader("Document Preview")
        try:
            if suffix.lower() == '.pdf':
                # Convert first page for preview
                images = convert_from_path(tmp_path, first_page=1, last_page=1)
                if images:
                    st.image(images[0], caption="First Page Preview", use_column_width=True)
            else:
                st.image(tmp_path, caption="Uploaded Image", use_column_width=True)
        except Exception as e:
            st.warning(f"Could not generate preview: {e}")

    with col2:
        st.subheader("Analysis")
        if st.button("Run Analysis", type="primary"):
            with st.spinner("Analyzing document..."):
                try:
                    # Run the pipeline
                    results = analyze_document(tmp_path)
                    
                    # 1. Classification Result
                    cls_step = results.get("steps", {}).get("classification", {})
                    doc_type = cls_step.get("detected_type", "Unknown")
                    confidence = cls_step.get("confidence", 0)
                    
                    st.success("Analysis Complete!")
                    
                    # Display metrics
                    m1, m2, m3 = st.columns(3)
                    m1.metric("Document Type", doc_type.replace("_", " ").title())
                    m2.metric("Confidence", f"{confidence:.2f}")
                    m3.metric("Status", results.get("status", "Unknown"))

                    # 2. Extracted Data
                    st.subheader("Extracted Fields")
                    data = results.get("data", {})
                    if data:
                        st.json(data)
                    else:
                        st.info("No structured data extracted.")

                    # 3. Technical Details (Expandable)
                    with st.expander("View Pipeline Details"):
                        st.write("Full JSON Output:")
                        st.json(results)

                except Exception as e:
                    st.error(f"An error occurred during analysis: {e}")
                    import traceback
                    st.code(traceback.format_exc())

    # Cleanup temp file
    # We delay cleanup until we are sure we don't need it or let the OS handle it if complex
    # Ideally, we should delete it, but Streamlit's rerun model makes this tricky if we want to keep the file across reruns without re-uploading.
    # Since we write it every time `uploaded_file` is true (which is every rerun where the file is present in the widget),
    # we can delete it at the end of the script execution.
    try:
        os.unlink(tmp_path)
    except:
        pass
