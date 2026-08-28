export interface EnderecoView {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface EnderecoGoogleSugestaoView {
  placeId: string;
  descricao: string;
  textoPrincipal: string;
  textoSecundario: string;
}

export interface EnderecoGoogleResolvidoView {
  googlePlaceId: string | null;
  enderecoFormatado: string | null;
}
