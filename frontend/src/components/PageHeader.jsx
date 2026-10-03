import { useNavigate } from 'react-router-dom';
import styles from '../styles/pages.module.css';

export default function PageHeader({ title, subtitle }) {
  const navigate = useNavigate();
  return (
    <>
      <button className={styles.smallBtn} onClick={() => navigate('/home')}>← Home</button>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>
    </>
  );
}