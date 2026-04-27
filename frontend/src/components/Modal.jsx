function Modal({ title, open, onClose, children, width = 760, closeOnOverlayClick = true }) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-card" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="danger" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
