import { useState } from "react";

export default function useBannerState() {
  const [
    bannerModelo,
    setBannerModelo,
  ] = useState("mercadolivre");

  const [
    modeloPremiumBanner,
    setModeloPremiumBanner,
  ] = useState("premium");

  const [
    imagemBanner,
    setImagemBanner,
  ] = useState(null);

  const [
    categoriaBanner,
    setCategoriaBanner,
  ] = useState("autopecas");

  const [
    estiloBanner,
    setEstiloBanner,
  ] = useState("premium");

  const [
    tamanhoBanner,
    setTamanhoBanner,
  ] = useState("1200x1200");

  const [
    fundoBanner,
    setFundoBanner,
  ] = useState("automatico");

  return {
    bannerModelo,
    setBannerModelo,

    modeloPremiumBanner,
    setModeloPremiumBanner,

    imagemBanner,
    setImagemBanner,

    categoriaBanner,
    setCategoriaBanner,

    estiloBanner,
    setEstiloBanner,

    tamanhoBanner,
    setTamanhoBanner,

    fundoBanner,
    setFundoBanner,
  };
}